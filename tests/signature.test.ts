import { describe, expect, it } from "vitest";
import { detectFileType, signatureMatchesDeclared } from "@/lib/storage/signature";

const bytes = (...v: number[]) => new Uint8Array([...v, ...new Array(32).fill(0)]);
const ascii = (s: string, pad = 32) => new Uint8Array([...s].map((c) => c.charCodeAt(0)).concat(new Array(pad).fill(0)));

describe("detectFileType", () => {
  it("recognises common photo formats", () => {
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(detectFileType(ascii("RIFF\0\0\0\0WEBP"))).toBe("image/webp");
    expect(detectFileType(ascii("\0\0\0\x18ftypheic"))).toBe("image/heic");
  });

  it("recognises video and audio containers", () => {
    expect(detectFileType(ascii("\0\0\0\x20ftypisom"))).toBe("video/mp4");
    expect(detectFileType(ascii("\0\0\0\x14ftypqt  "))).toBe("video/quicktime");
    expect(detectFileType(ascii("\0\0\0\x20ftypM4A "))).toBe("audio/mp4");
    expect(detectFileType(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe("video/webm");
    expect(detectFileType(ascii("OggS"))).toBe("audio/ogg");
    expect(detectFileType(ascii("ID3\x04"))).toBe("audio/mpeg");
    expect(detectFileType(ascii("RIFF\0\0\0\0WAVE"))).toBe("audio/wav");
    expect(detectFileType(ascii("%PDF-1.7"))).toBe("application/pdf");
  });

  it("rejects unknown content", () => {
    expect(detectFileType(ascii("<html><script>"))).toBeNull();
    expect(detectFileType(ascii("MZ\x90\0"))).toBeNull(); // executável
    expect(detectFileType(new Uint8Array([1]))).toBeNull();
  });
});

describe("signatureMatchesDeclared", () => {
  it("accepts shared containers for audio recorded in the browser", () => {
    expect(signatureMatchesDeclared(bytes(0x1a, 0x45, 0xdf, 0xa3), "audio/webm")).toBe(true);
    expect(signatureMatchesDeclared(ascii("\0\0\0\x20ftypisom"), "audio/mp4")).toBe(true);
  });
  it("rejects a disguised file", () => {
    expect(signatureMatchesDeclared(ascii("<svg onload=alert(1)>"), "image/png")).toBe(false);
    expect(signatureMatchesDeclared(ascii("%PDF-1.4"), "image/jpeg")).toBe(false);
  });
});
