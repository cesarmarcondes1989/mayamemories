import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { applyRules, pickItems, CAPACITY } = await import("@/features/story/curate");
import type { Story, StoryItem } from "@/features/story/build";

const item = (id: string, date: string, author: string, authorId: string, extra: Partial<StoryItem> = {}): StoryItem => ({
  id, title: id, description: null, type: "photo", date, author, authorId, highlight: false, media: [], comments: [], ...extra,
});

function story(items: StoryItem[]): Story {
  const chapters = new Map<string, StoryItem[]>();
  for (const i of items) chapters.set(i.date.slice(0, 7), [...(chapters.get(i.date.slice(0, 7)) ?? []), i]);
  return {
    period: "2026", subject: "Alice", vaultTitle: "Baú", years: ["2026"], cover: null,
    contributors: [...new Set(items.map((i) => i.author))],
    chapters: [...chapters.entries()].map(([key, its]) => ({ key, label: key, items: its })),
  };
}

describe("applyRules", () => {
  it("removes every memory and comment by an excluded person", () => {
    const s = story([
      item("a", "2026-01-02", "Tio", "p-tio"),
      item("b", "2026-01-03", "Vó", "p-vo", { comments: [{ author: "Tio", authorId: "p-tio", body: "oi" }, { author: "Mãe", authorId: "p-mae", body: "lindo" }] }),
    ]);
    const out = applyRules(s, { exclude: [{ person_id: "p-tio", name: "Tio", reason: "" }], prioritize: [], notes: "" });
    const all = out.chapters.flatMap((c) => c.items);
    expect(all.map((i) => i.id)).toEqual(["b"]);
    expect(all[0].comments.map((c) => c.author)).toEqual(["Mãe"]);
    expect(out.contributors).not.toContain("Tio");
  });
});

describe("pickItems", () => {
  it("keeps everything when it fits", () => {
    const s = story([item("a", "2026-01-02", "Vó", "v"), item("b", "2026-02-02", "Pai", "p")]);
    expect(pickItems(s, "film", { exclude: [], prioritize: [], notes: "" })).toEqual(["a", "b"]);
  });

  it("caps, covers every month and favors prioritized people", () => {
    const many: StoryItem[] = [];
    for (let m = 1; m <= 12; m++) for (let k = 0; k < 10; k++) {
      many.push(item(`m${m}-${k}`, `2026-${String(m).padStart(2, "0")}-${String(k + 1).padStart(2, "0")}`, k < 8 ? "Mãe" : "Tia", k < 8 ? "mae" : "tia"));
    }
    const s = story(many);
    const ids = pickItems(s, "film", { exclude: [], prioritize: [{ person_id: "tia", name: "Tia", weight: 3, reason: "" }], notes: "" });
    expect(ids.length).toBe(CAPACITY.film);
    const months = new Set(ids.map((id) => id.split("-")[0]));
    expect(months.size).toBe(12);
    const tia = ids.filter((id) => Number(id.split("-")[1]) >= 8).length;
    expect(tia).toBeGreaterThanOrEqual(15);
  });
});
