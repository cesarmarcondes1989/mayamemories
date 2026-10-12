import { describe, expect, it } from "vitest";
import { checkFileAgainstLimits, DEFAULT_LIMITS, guessMime, normalizeLimits } from "@/lib/storage/limits";

describe("upload limits", () => {
  it("accepts a normal phone photo", () => {
    const r = checkFileAgainstLimits({ name: "IMG_0001.JPG", size: 3_000_000, type: "image/jpeg" }, DEFAULT_LIMITS);
    expect(r).toEqual({ ok: true, kind: "image", mime: "image/jpeg" });
  });

  it("guesses HEIC when the browser sends an empty type", () => {
    expect(guessMime("IMG_0002.HEIC", "")).toBe("image/heic");
    expect(checkFileAgainstLimits({ name: "IMG_0002.HEIC", size: 2_000_000, type: "" }, DEFAULT_LIMITS).ok).toBe(true);
  });

  it("strips codec parameters from recorded audio", () => {
    const r = checkFileAgainstLimits({ name: "a.webm", size: 100_000, type: "audio/webm;codecs=opus" }, DEFAULT_LIMITS);
    expect(r.ok && r.kind).toBe("audio");
  });

  it("rejects oversized and overlong files with a clear message", () => {
    const big = checkFileAgainstLimits({ name: "v.mp4", size: DEFAULT_LIMITS.video.max_bytes + 1, type: "video/mp4" }, DEFAULT_LIMITS);
    expect(big.ok).toBe(false);
    expect(!big.ok && big.error).toMatch(/limite de \d+ MB/);
    const long = checkFileAgainstLimits({ name: "v.mp4", size: 1000, type: "video/mp4", durationSeconds: 99999 }, DEFAULT_LIMITS);
    expect(!long.ok && long.error).toMatch(/minutos/);
  });

  it("rejects unsupported formats", () => {
    expect(checkFileAgainstLimits({ name: "x.exe", size: 10, type: "application/x-msdownload" }, DEFAULT_LIMITS).ok).toBe(false);
    expect(checkFileAgainstLimits({ name: "x.svg", size: 10, type: "image/svg+xml" }, DEFAULT_LIMITS).ok).toBe(false);
  });

  it("merges partial settings with defaults", () => {
    const l = normalizeLimits({ image: { max_bytes: 1 } });
    expect(l.image.max_bytes).toBe(1);
    expect(l.image.mime).toContain("image/jpeg");
    expect(l.video).toEqual(DEFAULT_LIMITS.video);
  });
});
