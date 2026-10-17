import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { periodLabel, type Story, type StoryChapter, type StoryItem } from "./build";
import { aiConfigured, writeWithAI } from "./ai";

// Textos do livro/filme: sempre há um texto para mostrar (modelo), e a IA
// reescreve em segundo plano o que estiver faltando ou desatualizado.

export type StoryTexts = Record<string, string>;
type Stored = { section: string; body: string; source: string; source_key: string | null; updated_at: string };

export const sectionFor = (chapter: StoryChapter) => `m-${chapter.key}`;

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
const keyFor = (items: StoryItem[]) => `${items.length}-${hash(items.map((i) => `${i.id}|${i.title}|${i.description}`).join("~"))}`;

function sectionsOf(story: Story) {
  const all = story.chapters.flatMap((c) => c.items);
  return [
    { section: "abertura", items: all, kind: "abertura" as const },
    ...story.chapters.map((c) => ({ section: sectionFor(c), items: c.items, kind: "capitulo" as const, chapter: c })),
    { section: "fim", items: all, kind: "fim" as const },
  ];
}

function list(items: StoryItem[], max = 40): string {
  return items
    .slice(0, max)
    .map((i) => `- ${i.date} · ${i.type} · "${i.title ?? "sem título"}" · guardado por ${i.author}${i.description ? ` · ${i.description}` : ""}`)
    .join("\n");
}

function template(kind: "abertura" | "capitulo" | "fim", story: Story, items: StoryItem[], chapter?: StoryChapter): string {
  const people = [...new Set(items.map((i) => i.author))];
  const names = people.length > 1 ? `${people.slice(0, -1).join(", ")} e ${people.at(-1)}` : (people[0] ?? "a família");
  if (kind === "abertura") {
    return `${story.subject}, este livro guarda ${items.length} lembranças de ${periodLabel(story.period)}. Cada foto, cada áudio e cada palavra daqui foi escolhida por alguém que te ama: ${names}. Guardamos tudo pra você.`;
  }
  if (kind === "fim") {
    return `Este foi só o começo. Enquanto você crescia, a família continuou guardando: um sorriso, uma visita, uma música antes de dormir. Quando ler isto, saiba que você nunca esteve só nessa história.`;
  }
  const titles = items.slice(0, 3).map((i) => i.title).filter(Boolean);
  return `Em ${chapter!.label}, ${names} ${people.length > 1 ? "guardaram" : "guardou"} ${items.length} ${items.length === 1 ? "lembrança" : "lembranças"}${titles.length ? `: ${titles.join(", ")}` : ""}.`;
}

/** Textos para mostrar agora + lista do que precisa ser (re)escrito. */
export async function resolveStoryTexts(vaultId: string, story: Story): Promise<{ texts: StoryTexts; stale: string[] }> {
  const admin = createAdminClient();
  const { data } = await admin.from("story_texts").select("section, body, source, source_key, updated_at").eq("vault_id", vaultId).eq("period", story.period);
  const stored = new Map(((data ?? []) as Stored[]).map((r) => [r.section, r]));
  const texts: StoryTexts = {};
  const stale: string[] = [];
  for (const s of sectionsOf(story)) {
    const row = stored.get(s.section);
    const key = keyFor(s.items);
    const fresh = row && (row.source === "edited" || row.source_key === key);
    texts[s.section] = row?.body ?? template(s.kind, story, s.items, "chapter" in s ? s.chapter : undefined);
    const pending = row?.source_key?.startsWith("pending") && Date.now() - new Date(row.updated_at).getTime() < 3 * 60_000;
    if (!fresh && !pending) stale.push(s.section);
  }
  return { texts, stale };
}

/** Roda depois da resposta (after): escreve com IA o que estiver faltando. */
export async function refreshStoryTexts(vault: { id: string; ai_enabled?: boolean }, story: Story, stale: string[]) {
  if (!stale.length) return;
  const admin = createAdminClient();
  const useAI = vault.ai_enabled !== false && aiConfigured();
  const sections = sectionsOf(story).filter((s) => stale.includes(s.section));
  // Marca como "em andamento" para não gerar duas vezes com várias visitas ao mesmo tempo
  await admin.from("story_texts").upsert(
    sections.map((s) => ({ vault_id: vault.id, period: story.period, section: s.section, body: template(s.kind, story, s.items, "chapter" in s ? s.chapter : undefined), source: "template", source_key: `pending-${Date.now()}` })),
    { onConflict: "vault_id,period,section", ignoreDuplicates: false },
  );
  const queue = [...sections];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const chapter = "chapter" in s ? s.chapter : undefined;
      let body: string | null = null;
      if (useAI) {
        const task =
          s.kind === "abertura"
            ? `Escreva a abertura do livro de ${story.subject} (${periodLabel(story.period)}), apresentando o que vem pela frente.`
            : s.kind === "fim"
              ? `Escreva o texto de encerramento do livro de ${story.subject} (${periodLabel(story.period)}), olhando para o futuro.`
              : `Escreva o texto de abertura do capítulo "${chapter!.label}" do livro de ${story.subject}, contando o que aconteceu nesse mês.`;
        body = await writeWithAI(task, list(s.items), s.kind === "capitulo" ? "entre 50 e 90 palavras" : "entre 70 e 120 palavras");
      }
      await admin.from("story_texts").update({
        body: body ?? template(s.kind, story, s.items, chapter),
        source: body ? "ai" : "template",
        source_key: keyFor(s.items),
      }).eq("vault_id", vault.id).eq("period", story.period).eq("section", s.section).neq("source", "edited");
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}
