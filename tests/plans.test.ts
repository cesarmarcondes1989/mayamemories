import { describe, expect, it } from "vitest";
import { parsePriceToCents, priceLabel } from "@/lib/plans";

const base = { price_monthly_cents: null, price_yearly_cents: null, price_once_cents: null };

describe("priceLabel", () => {
  it("free plan", () => {
    expect(priceLabel({ ...base, billing: "free" }).main).toBe("R$ 0");
  });
  it("undefined price asks to talk", () => {
    expect(priceLabel({ ...base, billing: "subscription" }).note).toBe("Fale com a gente");
    expect(priceLabel({ ...base, billing: "one_time" }).main).toBe("Sob consulta");
  });
  it("monthly with yearly savings", () => {
    const l = priceLabel({ ...base, billing: "subscription", price_monthly_cents: 2990, price_yearly_cents: 29900 });
    expect(l.main).toMatch(/29,90/);
    expect(l.note).toMatch(/economize 17%/);
  });
  it("one time price", () => {
    expect(priceLabel({ ...base, billing: "one_time", price_once_cents: 129900 }).main).toMatch(/1\.299,00/);
  });
});

describe("parsePriceToCents", () => {
  it.each([
    ["29,90", 2990],
    ["29.90", 2990],
    ["R$ 1.299,00", 129900],
    ["1.299", 129900],
    ["0", 0],
    ["", null],
    ["abc", null],
  ])("%s → %s", (input, expected) => {
    expect(parsePriceToCents(input)).toBe(expected);
  });
});
