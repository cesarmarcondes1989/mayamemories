import "server-only";
import { createClient } from "@/lib/supabase/server";
import { MEMORY_SELECT, attachMediaUrls, type MemoryRow } from "@/features/memories/queries";

// Junta as memórias aprovadas de um período em capítulos (um por mês).
// Base do livro e do filme. Cartas ainda trancadas e memórias privadas ficam de fora.

export type StoryMedia = { type: string; url: string; mime: string };
export type StoryItem = {
  id: string;
  title: string | null;
  description: string | null;
  type: string;
  date: string;
  author: string;
  authorId: string | null;
  highlight: boolean;
  media: StoryMedia[];
  comments: Array<{ author: string; authorId: string | null; body: string }>;
};
export type StoryChapter = { key: string; label: string; items: StoryItem[] };
export type Story = {
  period: string;
  subject: string;
  vaultTitle: string;
  chapters: StoryChapter[];
  contributors: string[];
  years: string[];
  cover: string | null;
};

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]} de ${y}`;
};

export async function getStory(vault: { id: string; title: string; subject_name: string }, period: string): Promise<Story> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  let q = supabase
    .from("memories")
    .select(MEMORY_SELECT)
    .eq("vault_id", vault.id)
    .eq("moderation_status", "approved")
    .is("deleted_at", null)
    .in("visibility", ["family", "capsule"])
    .or(`unlock_at.is.null,unlock_at.lte.${now}`)
    .order("occurred_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(600);
  if (/^\d{4}$/.test(period)) q = q.gte("occurred_at", `${period}-01-01`).lte("occurred_at", `${period}-12-31`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = await attachMediaUrls((data ?? []) as unknown as MemoryRow[]);

  const ids = rows.map((r) => r.id);
  const { data: comments } = ids.length
    ? await supabase
        .from("memory_comments")
        .select("memory_id, body, author:people!memory_comments_author_person_id_fkey(id, display_name)")
        .in("memory_id", ids)
        .eq("status", "approved")
        .is("deleted_at", null)
        .order("created_at")
    : { data: [] };
  const byMemory = new Map<string, StoryItem["comments"]>();
  for (const c of (comments ?? []) as unknown as Array<{ memory_id: string; body: string; author: { id: string; display_name: string } | null }>) {
    byMemory.set(c.memory_id, [...(byMemory.get(c.memory_id) ?? []), { author: c.author?.display_name ?? "Alguém", authorId: c.author?.id ?? null, body: c.body }]);
  }

  const chapters = new Map<string, StoryChapter>();
  const contributors = new Set<string>();
  for (const r of rows) {
    const date = (r.occurred_at ?? r.created_at).slice(0, 10);
    const key = date.slice(0, 7);
    if (!chapters.has(key)) chapters.set(key, { key, label: monthLabel(key), items: [] });
    const author = r.author?.display_name ?? "Família";
    contributors.add(author);
    chapters.get(key)!.items.push({
      id: r.id,
      title: r.title,
      description: r.description,
      type: r.memory_type,
      date,
      author,
      authorId: r.author?.id ?? null,
      highlight: r.is_highlight,
      media: r.media_assets.filter((a) => a.url).map((a) => ({ type: a.media_type, url: a.url!, mime: a.mime_type })),
      comments: byMemory.get(r.id) ?? [],
    });
  }

  // Anos disponíveis para o seletor
  const { data: dates } = await supabase
    .from("memories")
    .select("occurred_at")
    .eq("vault_id", vault.id)
    .eq("moderation_status", "approved")
    .is("deleted_at", null)
    .not("occurred_at", "is", null)
    .limit(2000);
  const years = [...new Set((dates ?? []).map((d) => String(d.occurred_at).slice(0, 4)))].sort();

  const all = [...chapters.values()].flatMap((c) => c.items);
  const coverItem = all.find((i) => i.highlight && i.media.some((m) => m.type === "image")) ?? all.find((i) => i.media.some((m) => m.type === "image"));
  return {
    period,
    subject: vault.subject_name,
    vaultTitle: vault.title,
    chapters: [...chapters.values()],
    contributors: [...contributors],
    years,
    cover: coverItem?.media.find((m) => m.type === "image")?.url ?? null,
  };
}

export const periodLabel = (period: string) => (period === "tudo" ? "do começo até aqui" : period);
