import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("qr", () => {
  it("encodes the token URL as SVG and PNG", async () => {
    const { qrPng, qrSvg } = await import("@/lib/qr");
    const svg = await qrSvg("https://exemplo.com/m/abcdefghijklmnopqrst");
    expect(svg).toContain("<svg");
    const png = await qrPng("https://exemplo.com/m/abcdefghijklmnopqrst", 256);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
  });
});
