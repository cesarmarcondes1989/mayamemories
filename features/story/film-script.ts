// Roteiro do filme em motion: uma lista de "atos", cada um com um estilo de
// animação e as memórias que ele mostra. A IA escreve o roteiro; este módulo
// tem o diretor automático (sem IA) e o validador que deixa qualquer roteiro
// seguro de tocar. Puro (sem servidor) para poder testar.

import type { Story, StoryItem } from "./build";

export const FILM_STYLES = ["chapter", "kinetic", "polaroids", "collage", "spotlight", "letter", "voice", "video"] as const;
export type FilmStyle = (typeof FILM_STYLES)[number];

export type FilmAct = { style: FilmStyle; heading: string; line: string; items: string[] };
export type FilmScript = {
  title: string;
  tagline: string;
  acts: FilmAct[];
  ending: string;
  stats: { memories: number; people: number; photos: number; voices: number };
};

const has = (i: StoryItem, type: string) => i.media.some((m) => m.type === type);
const isPhoto = (i: StoryItem) => has(i, "image") && !has(i, "video") && !has(i, "audio");
const isLetter = (i: StoryItem) => !i.media.length && Boolean(i.description);

/** Que estilos uma memória aceita. */
export function stylesFor(i: StoryItem): FilmStyle[] {
  if (has(i, "video")) return ["video"];
  if (has(i, "audio")) return ["voice"];
  if (has(i, "image")) return ["spotlight", "polaroids", "collage"];
  if (i.description) return ["letter"];
  return [];
}

export function firstSentence(text: string, max = 110): string {
  const s = text.replace(/\s+/g, " ").trim();
  const cut = s.match(/^.{20,}?[.!?](\s|$)/)?.[0]?.trim() ?? s;
  return cut.length > max ? `${cut.slice(0, max - 1).replace(/\s+\S*$/, "")}…` : cut;
}

export function filmStats(story: Story): FilmScript["stats"] {
  const items = story.chapters.flatMap((c) => c.items);
  return {
    memories: items.length,
    people: new Set(items.map((i) => i.author)).size,
    photos: items.filter((i) => has(i, "image")).length,
    voices: items.filter((i) => has(i, "audio")).length,
  };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Diretor automático: um roteiro bom sem IA (e o plano B quando a IA falha). */
export function directFilm(story: Story, texts: Record<string, string>, label: string): FilmScript {
  const acts: FilmAct[] = [];
  const intro = texts.abertura ? firstSentence(texts.abertura, 120) : "";
  if (intro) acts.push({ style: "kinetic", heading: "", line: intro, items: [] });
  for (const c of story.chapters) {
    const chapterText = texts[`m-${c.key}`];
    acts.push({ style: "chapter", heading: c.label, line: chapterText ? firstSentence(chapterText) : "", items: [] });
    const photos = c.items.filter(isPhoto);
    const best = photos.find((i) => i.highlight);
    const rest = photos.filter((i) => i !== best);
    if (best) acts.push({ style: "spotlight", heading: best.title ?? "", line: best.description ? firstSentence(best.description, 90) : "", items: [best.id] });
    if (rest.length >= 4) acts.push({ style: "collage", heading: rest[0].title ?? c.label, line: "", items: rest.slice(0, 6).map((i) => i.id) });
    const left = rest.length >= 4 ? rest.slice(6) : rest;
    for (let k = 0; k < left.length; k += 3) {
      const group = left.slice(k, k + 3);
      if (group.length === 1) acts.push({ style: "spotlight", heading: group[0].title ?? "", line: group[0].description ? firstSentence(group[0].description, 90) : "", items: [group[0].id] });
      else acts.push({ style: "polaroids", heading: group[0].title ?? "", line: "", items: group.map((i) => i.id) });
    }
    for (const i of c.items) {
      if (has(i, "video")) acts.push({ style: "video", heading: i.title ?? "", line: `guardado por ${i.author}`, items: [i.id] });
      else if (has(i, "audio")) acts.push({ style: "voice", heading: i.title ?? "", line: i.description ? firstSentence(i.description, 90) : `a voz de ${i.author}`, items: [i.id] });
      else if (isLetter(i)) acts.push({ style: "letter", heading: i.title ?? "", line: "", items: [i.id] });
    }
  }
  return {
    title: clip(`A história de ${story.subject}`, 60),
    tagline: label,
    acts,
    ending: texts.fim ? firstSentence(texts.fim, 160) : "Este foi só o começo. A família continua guardando, pra você.",
    stats: filmStats(story),
  };
}

/** Valida um roteiro (da IA ou do banco): ids existentes, estilo compatível, textos curtos. */
export function sanitizeScript(raw: Partial<FilmScript> | null | undefined, story: Story, fallback: FilmScript): FilmScript {
  if (!raw || !Array.isArray(raw.acts)) return fallback;
  const byId = new Map(story.chapters.flatMap((c) => c.items).map((i) => [i.id, i]));
  const used = new Set<string>();
  const acts: FilmAct[] = [];
  for (const a of raw.acts.slice(0, 60)) {
    if (!a || !FILM_STYLES.includes(a.style as FilmStyle)) continue;
    const items = (Array.isArray(a.items) ? a.items : []).filter((id) => typeof id === "string" && byId.has(id) && !used.has(id));
    let style = a.style as FilmStyle;
    const heading = clip(String(a.heading ?? ""), 70);
    const line = clip(String(a.line ?? ""), 160);
    if (style === "chapter" || style === "kinetic") {
      if (heading || line) acts.push({ style, heading, line, items: [] });
      continue;
    }
    if (!items.length) continue;
    const first = byId.get(items[0])!;
    const allowed = stylesFor(first);
    if (!allowed.includes(style)) style = allowed[0];
    if (!style) continue;
    // Atos de várias fotos só levam fotos; os demais, uma memória
    const chosen = style === "polaroids" || style === "collage" ? items.filter((id) => isPhoto(byId.get(id)!)).slice(0, style === "collage" ? 6 : 4) : [items[0]];
    if (style === "collage" && chosen.length < 3) style = chosen.length === 1 ? "spotlight" : "polaroids";
    chosen.forEach((id) => used.add(id));
    acts.push({ style, heading, line, items: chosen });
  }
  if (!acts.some((a) => a.items.length)) return fallback;
  return {
    title: clip(String(raw.title || fallback.title), 60),
    tagline: clip(String(raw.tagline || fallback.tagline), 80),
    acts,
    ending: clip(String(raw.ending || fallback.ending), 220),
    stats: fallback.stats,
  };
}

export function scriptKey(story: Story, texts: Record<string, string>): string {
  let h = 2166136261;
  const s = story.chapters.flatMap((c) => c.items.map((i) => `${i.id}${i.title}`)).join("|") + (texts.abertura ?? "") + (texts.fim ?? "");
  for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619);
  return `f${story.chapters.reduce((a, c) => a + c.items.length, 0)}-${(h >>> 0).toString(36)}`;
}
