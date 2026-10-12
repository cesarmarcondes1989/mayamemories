import { describe, expect, it } from "vitest";
import { createMemorySchema, safeNextPath } from "@/lib/validation/schemas";
import { toCsv } from "@/features/admin/export";

describe("safeNextPath", () => {
  it("keeps internal paths", () => {
    expect(safeNextPath("/minhas-memorias?x=1")).toBe("/minhas-memorias?x=1");
    expect(safeNextPath("/m/abc")).toBe("/m/abc");
  });
  it("blocks open redirects", () => {
    expect(safeNextPath("https://evil.example/phish")).toBe("/inicio");
    expect(safeNextPath("//evil.example")).toBe("/inicio");
    expect(safeNextPath("/\\evil.example")).toBe("/inicio");
    expect(safeNextPath("javascript:alert(1)")).toBe("/inicio");
    expect(safeNextPath(null, "/x")).toBe("/x");
  });
});

describe("createMemorySchema", () => {
  it("requires a file for photos and text for messages", () => {
    expect(createMemorySchema.safeParse({ kind: "photo", files: [] }).success).toBe(false);
    expect(createMemorySchema.safeParse({ kind: "text", files: [] }).success).toBe(false);
    expect(createMemorySchema.safeParse({ kind: "text", description: "Oi Maya" }).success).toBe(true);
  });
  it("requires an opening date for letters", () => {
    expect(createMemorySchema.safeParse({ kind: "letter", description: "Querida Maya" }).success).toBe(false);
    expect(createMemorySchema.safeParse({ kind: "letter", description: "Querida Maya", unlockAt: "2042-03-10" }).success).toBe(true);
  });
  it("refuses public visibility from contributors", () => {
    expect(createMemorySchema.safeParse({ kind: "text", description: "x", visibility: "public" }).success).toBe(false);
  });
  it("validates visit data", () => {
    expect(createMemorySchema.safeParse({ kind: "visit" }).success).toBe(false);
    expect(
      createMemorySchema.safeParse({ kind: "visit", visit: { occurredAt: "2027-03-12", visitType: "maternity" } }).success,
    ).toBe(true);
  });
});

describe("toCsv", () => {
  it("escapes quotes, commas and spreadsheet formulas", () => {
    const csv = toCsv([{ a: 'diz "oi", Maya', b: "=HYPERLINK(1)" }]);
    expect(csv).toBe('a,b\n"diz ""oi"", Maya",\'=HYPERLINK(1)');
  });
});
