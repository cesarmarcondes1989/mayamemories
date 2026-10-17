import { describe, expect, it } from "vitest";
import { isPlaceholderEmail } from "@/lib/email-identity";

describe("isPlaceholderEmail", () => {
  it("detects internal addresses", () => {
    expect(isPlaceholderEmail("nfc-1b2c3d4e-0000-0000-0000-000000000000@site.app")).toBe(true);
    expect(isPlaceholderEmail("guest-1b2c3d4e-0000-0000-0000-000000000000@site.app")).toBe(true);
    expect(isPlaceholderEmail(null)).toBe(true);
  });
  it("keeps real addresses", () => {
    expect(isPlaceholderEmail("vovo@gmail.com")).toBe(false);
    expect(isPlaceholderEmail("nfc.fan@gmail.com")).toBe(false);
  });
});
