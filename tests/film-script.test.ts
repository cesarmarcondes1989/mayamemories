import { describe, expect, it } from "vitest";
import { directFilm, sanitizeScript, scriptKey, firstSentence } from "@/features/story/film-script";
import type { Story, StoryItem } from "@/features/story/build";

const img = { type: "image", url: "https://x/i.jpg", mime: "image/jpeg" };
const vid = { type: "video", url: "https://x/v.mp4", mime: "video/mp4" };
const aud = { type: "audio", url: "https://x/a.mp3", mime: "audio/mpeg" };
const item = (id: string, date: string, extra: Partial<StoryItem> = {}): StoryItem => ({
  id, title: `t-${id}`, description: null, type: "photo", date, author: "Vó", authorId: "p1", highlight: false, media: [img], comments: [], ...extra,
});
const story: Story = {
  period: "2026", subject: "Alice", vaultTitle: "Baú", years: ["2026"], cover: null, contributors: ["Vó"],
  chapters: [
    { key: "2026-01", label: "janeiro de 2026", items: [item("a", "2026-01-01", { highlight: true }), item("b", "2026-01-02"), item("c", "2026-01-03"), item("v", "2026-01-04", { media: [vid] })] },
    { key: "2026-02", label: "fevereiro de 2026", items: [item("s", "2026-02-01", { media: [aud] }), item("l", "2026-02-02", { media: [], description: "Querida Alice, você chegou." })] },
  ],
};

describe("directFilm", () => {
  it("builds chapters and picks a style that matches each memory", () => {
    const s = directFilm(story, { abertura: "Este é o seu primeiro ano. Que ano!" }, "2026");
    expect(s.acts[0]).toMatchObject({ style: "kinetic", line: "Este é o seu primeiro ano." });
    expect(s.acts.filter((a) => a.style === "chapter").map((a) => a.heading)).toEqual(["janeiro de 2026", "fevereiro de 2026"]);
    const styleOf = (id: string) => s.acts.find((a) => a.items.includes(id))?.style;
    expect(styleOf("a")).toBe("spotlight");
    expect(styleOf("b")).toBe("polaroids");
    expect(styleOf("v")).toBe("video");
    expect(styleOf("s")).toBe("voice");
    expect(styleOf("l")).toBe("letter");
    expect(s.stats).toEqual({ memories: 6, people: 1, photos: 3, voices: 1 });
  });
});

describe("sanitizeScript", () => {
  const fallback = directFilm(story, {}, "2026");
  it("drops unknown ids, repeated memories and fixes incompatible styles", () => {
    const out = sanitizeScript({
      title: "Filme",
      acts: [
        { style: "spotlight", heading: "Voz", line: "", items: ["s"] },
        { style: "collage", heading: "", line: "", items: ["a", "b", "zzz", "v"] },
        { style: "letter", heading: "", line: "", items: ["a"] },
        { style: "kinetic", heading: "", line: "Você é amada.", items: [] },
        { style: "hack" as never, heading: "x", line: "", items: ["c"] },
      ],
    }, story, fallback);
    expect(out.acts.map((a) => [a.style, a.items])).toEqual([
      ["voice", ["s"]],
      ["polaroids", ["a", "b"]],
      ["kinetic", []],
    ]);
  });
  it("falls back when nothing playable is left", () => {
    expect(sanitizeScript({ acts: [{ style: "spotlight", heading: "", line: "", items: ["nope"] }] }, story, fallback)).toBe(fallback);
    expect(sanitizeScript(null, story, fallback)).toBe(fallback);
  });
});

describe("helpers", () => {
  it("firstSentence and scriptKey", () => {
    expect(firstSentence("Primeira frase longa aqui. Segunda.")).toBe("Primeira frase longa aqui.");
    expect(scriptKey(story, {})).toBe(scriptKey(story, {}));
    expect(scriptKey(story, { fim: "x" })).not.toBe(scriptKey(story, {}));
  });
});
