// Detecção do tipo REAL do arquivo pelos primeiros bytes ("magic numbers").
// Não confiamos no nome nem no Content-Type enviado pelo navegador.

export type DetectedType =
  | "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "image/heic"
  | "video/mp4" | "video/quicktime" | "video/webm" | "audio/mp4"
  | "audio/mpeg" | "audio/ogg" | "audio/wav" | "audio/aac" | "application/pdf";

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  return sig.every((b, i) => bytes[offset + i] === b);
}

export function detectFileType(bytes: Uint8Array): DetectedType | null {
  if (bytes.length < 4) return null;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(bytes, 0, 4) === "GIF8") return "image/gif";
  if (ascii(bytes, 0, 4) === "%PDF") return "application/pdf";
  if (ascii(bytes, 0, 4) === "RIFF" && bytes.length >= 12) {
    const t = ascii(bytes, 8, 4);
    if (t === "WEBP") return "image/webp";
    if (t === "WAVE") return "audio/wav";
  }
  if (ascii(bytes, 0, 4) === "OggS") return "audio/ogg";
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm"; // EBML (WebM/Matroska)
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heim", "heis"].includes(brand)) return "image/heic";
    if (brand === "qt  ") return "video/quicktime";
    if (brand.startsWith("M4A") || brand.startsWith("M4B")) return "audio/mp4";
    return "video/mp4"; // isom, mp41, mp42, avc1, iso5, 3gp...
  }
  if (ascii(bytes, 0, 3) === "ID3") return "audio/mpeg";
  if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return "audio/aac"; // ADTS
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "audio/mpeg"; // MPEG frame sync
  return null;
}

/** Contêineres compartilhados (mp4/webm) servem a áudio e vídeo. */
const COMPATIBLE: Record<DetectedType, string[]> = {
  "image/jpeg": ["image/jpeg"],
  "image/png": ["image/png"],
  "image/gif": ["image/gif"],
  "image/webp": ["image/webp"],
  "image/heic": ["image/heic", "image/heif"],
  "video/mp4": ["video/mp4", "video/quicktime", "audio/mp4", "audio/x-m4a", "audio/aac"],
  "video/quicktime": ["video/quicktime", "video/mp4"],
  "video/webm": ["video/webm", "audio/webm"],
  "audio/mp4": ["audio/mp4", "audio/x-m4a", "audio/aac", "video/mp4"],
  "audio/mpeg": ["audio/mpeg"],
  "audio/ogg": ["audio/ogg"],
  "audio/wav": ["audio/wav", "audio/x-wav"],
  "audio/aac": ["audio/aac", "audio/x-m4a", "audio/mp4"],
  "application/pdf": ["application/pdf"],
};

export function signatureMatchesDeclared(bytes: Uint8Array, declaredMime: string): boolean {
  const detected = detectFileType(bytes);
  if (!detected) return false;
  return COMPATIBLE[detected].includes(declaredMime);
}
