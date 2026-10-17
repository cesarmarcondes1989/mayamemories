import { describe, expect, it } from "vitest";
import { planExport, zipPathFor, type ExportAsset, type ExportMemory } from "@/lib/export/plan";

const mem = (id: string, date: string, title: string | null = "Primeiro banho"): ExportMemory => ({
  id, title, memory_type: "photo", occurred_at: date, created_at: "2026-10-01T10:00:00Z",
});
const asset = (id: string, memory: string, size: number, type = "image", path = `v/${memory}/${id}.jpg`): ExportAsset => ({
  id, memory_id: memory, storage_path: path, original_filename: "IMG_001.JPG", mime_type: "image/jpeg", size_bytes: size, media_type: type,
});

describe("zipPathFor", () => {
  it("builds a readable, dated path", () => {
    expect(zipPathFor(asset("1a2b3c4d-0000", "m1", 10), mem("m1", "2026-03-14", "Primeiro Banho!"))).toBe(
      "media/2026/fotos/2026-03-14_primeiro-banho_1a2b3c4d.jpg",
    );
  });
  it("falls back to file name and type folders", () => {
    expect(zipPathFor(asset("abcdef12-0000", "m1", 10, "audio", "v/m1/x.m4a"), mem("m1", "2025-01-02", null))).toBe(
      "media/2025/audios/2025-01-02_img-001_abcdef12.m4a",
    );
  });
});

describe("planExport", () => {
  const memories = [mem("m1", "2026-01-01"), mem("m2", "2026-02-01"), mem("m3", "2026-03-01")];
  it("splits by size in chronological order", () => {
    const parts = planExport([asset("c", "m3", 60), asset("a", "m1", 60), asset("b", "m2", 60)], memories, 100);
    expect(parts.map((p) => p.files.map((f) => f.memory_id))).toEqual([["m1"], ["m2"], ["m3"]]);
    expect(parts[0].from).toBe("2026-01-01");
  });
  it("keeps small files together and a big file alone", () => {
    const parts = planExport([asset("a", "m1", 10), asset("b", "m2", 10), asset("c", "m3", 500)], memories, 100);
    expect(parts.map((p) => p.files.length)).toEqual([2, 1]);
  });
  it("always has part 1", () => {
    expect(planExport([], [], 100)).toHaveLength(1);
  });
});
