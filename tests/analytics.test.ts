import { describe, expect, it } from "vitest";
import { parseUserAgent, sanitizePath } from "@/lib/analytics/ua";

describe("parseUserAgent", () => {
  it("iPhone Safari", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(ua)).toEqual({ device: "mobile", browser: "Safari", os: "iOS", bot: false });
  });
  it("Android Chrome inside Instagram", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 Instagram 300.0";
    expect(parseUserAgent(ua)).toMatchObject({ device: "mobile", browser: "Instagram (app)", os: "Android" });
  });
  it("Windows Edge desktop", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0";
    expect(parseUserAgent(ua)).toMatchObject({ device: "desktop", browser: "Edge", os: "Windows" });
  });
  it("bots and previews", () => {
    expect(parseUserAgent("WhatsApp/2.23").bot).toBe(true);
    expect(parseUserAgent("Googlebot/2.1").bot).toBe(true);
    expect(parseUserAgent("").bot).toBe(true);
  });
});

describe("sanitizePath", () => {
  it("never stores NFC tokens or ids", () => {
    expect(sanitizePath("/m/Mlys-NoEVX1m62leJEK9?falha=1")).toBe("/m/:token");
    expect(sanitizePath("/m/Mlys-NoEVX1m62leJEK9/entrar")).toBe("/m/:token/entrar");
    expect(sanitizePath("/convite/abc123")).toBe("/convite/:token");
    expect(sanitizePath("/?plano=familia#quero")).toBe("/");
  });
});
