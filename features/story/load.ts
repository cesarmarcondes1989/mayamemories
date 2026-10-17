import "server-only";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStory, type Story } from "./build";
import { refreshStoryTexts, resolveStoryTexts } from "./texts";
import { applyRules, filterStory, pickItems, refreshSelection, selectionKey, type StoryKind, type StoryRules } from "./curate";

const EMPTY: StoryRules = { exclude: [], prioritize: [], notes: "" };

/**
 * Livro/filme de um período, 100% automático:
 * regras da família -> seleção (conselho da família, em segundo plano) -> textos (IA, em segundo plano).
 * Sempre mostra algo na hora; o que a IA melhora aparece na próxima visita.
 */
export async function loadStory(periodo: string, kind: StoryKind) {
  if (!/^(\d{4}|tudo)$/.test(periodo)) notFound();
  const viewer = await requireMember();
  const supabase = await createClient();
  const { data: vault } = await supabase.from("vaults").select("id, title, subject_name, ai_enabled").eq("id", viewer.vault.id).maybeSingle();
  if (!vault) notFound();
  const admin = createAdminClient();

  const full = await getStory(vault, periodo);
  const { data: settings } = await admin.from("story_settings").select("rules").eq("vault_id", vault.id).maybeSingle();
  const rules = { ...EMPTY, ...((settings?.rules ?? {}) as Partial<StoryRules>) };
  const base = applyRules(full, rules);
  const key = selectionKey(base, rules);

  const { data: selections } = await admin.from("story_selections").select("kind, memory_ids, source_key, rationale, updated_at").eq("vault_id", vault.id).eq("period", periodo);
  const select = (k: StoryKind): { story: Story; rationale: string | null } => {
    const sel = selections?.find((s) => s.kind === k);
    if (sel?.source_key === key) return { story: filterStory(base, sel.memory_ids), rationale: sel.rationale };
    const pending = sel?.source_key === `pending-${key}` && Date.now() - new Date(sel.updated_at).getTime() < 5 * 60_000;
    if (!pending && base.chapters.length) after(() => refreshSelection(vault, base, k, rules, key));
    return { story: filterStory(base, pending ? sel!.memory_ids : pickItems(base, k, rules)), rationale: null };
  };

  const book = select("book");
  const current = kind === "book" ? book : select("film");
  // Os textos acompanham a seleção do livro (o filme usa os mesmos capítulos)
  const { texts, stale } = await resolveStoryTexts(vault.id, book.story);
  if (stale.length && book.story.chapters.length) after(() => refreshStoryTexts(vault, book.story, stale));

  const totalAll = full.chapters.reduce((a, c) => a + c.items.length, 0);
  return {
    viewer,
    vault,
    story: current.story,
    texts,
    rationale: current.rationale,
    totalAll,
    working: stale.length > 0 || current.rationale === null,
  };
}
