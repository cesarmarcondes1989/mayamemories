// Limites de upload: vêm de app_settings.upload_limits (configuráveis no painel).

export type MediaKind = "image" | "video" | "audio" | "document";

export type KindLimit = { max_bytes: number; max_seconds?: number; mime: string[] };

export type UploadLimits = {
  image: KindLimit;
  video: KindLimit;
  audio: KindLimit;
  document: KindLimit;
  max_files_per_memory: number;
  max_bytes_per_person: number;
};

export const DEFAULT_LIMITS: UploadLimits = {
  image: { max_bytes: 20 * 1024 * 1024, mime: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"] },
  video: { max_bytes: 200 * 1024 * 1024, max_seconds: 600, mime: ["video/mp4", "video/quicktime", "video/webm"] },
  audio: {
    max_bytes: 50 * 1024 * 1024,
    max_seconds: 900,
    mime: ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/x-wav", "audio/aac", "audio/x-m4a"],
  },
  document: { max_bytes: 20 * 1024 * 1024, mime: ["application/pdf", "image/jpeg", "image/png"] },
  max_files_per_memory: 10,
  max_bytes_per_person: 5 * 1024 * 1024 * 1024,
};

export function normalizeLimits(raw: unknown): UploadLimits {
  const r = (raw ?? {}) as Partial<UploadLimits>;
  return {
    image: { ...DEFAULT_LIMITS.image, ...(r.image ?? {}) },
    video: { ...DEFAULT_LIMITS.video, ...(r.video ?? {}) },
    audio: { ...DEFAULT_LIMITS.audio, ...(r.audio ?? {}) },
    document: { ...DEFAULT_LIMITS.document, ...(r.document ?? {}) },
    max_files_per_memory: r.max_files_per_memory ?? DEFAULT_LIMITS.max_files_per_memory,
    max_bytes_per_person: r.max_bytes_per_person ?? DEFAULT_LIMITS.max_bytes_per_person,
  };
}

/** Remove parâmetros como "audio/webm;codecs=opus" -> "audio/webm". */
export function baseMime(type: string): string {
  return type.split(";")[0].trim().toLowerCase();
}

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif",
  gif: "image/gif", mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  mp3: "audio/mpeg", m4a: "audio/x-m4a", aac: "audio/aac", ogg: "audio/ogg", oga: "audio/ogg", wav: "audio/wav",
  pdf: "application/pdf",
};

/** Alguns celulares enviam type vazio (ex.: HEIC); deduzimos pela extensão. */
export function guessMime(name: string, type: string): string {
  const t = baseMime(type || "");
  if (t && t !== "application/octet-stream") return t;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? "application/octet-stream";
}

export function mediaKindFor(mime: string, preferDocument = false): MediaKind | null {
  if (preferDocument && (mime === "application/pdf" || mime === "image/jpeg" || mime === "image/png")) return "document";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "document";
  return null;
}

export const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif",
  "image/gif": "gif", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "audio/webm": "webm",
  "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav",
  "audio/x-wav": "wav", "audio/aac": "aac", "application/pdf": "pdf",
};

export type FileCheck = { ok: true; kind: MediaKind; mime: string } | { ok: false; error: string };

export function checkFileAgainstLimits(
  file: { name: string; size: number; type: string; durationSeconds?: number },
  limits: UploadLimits,
  opts: { preferDocument?: boolean } = {},
): FileCheck {
  const mime = guessMime(file.name, file.type);
  const kind = mediaKindFor(mime, opts.preferDocument);
  if (!kind) return { ok: false, error: `O formato de "${file.name}" não é aceito.` };
  const limit = limits[kind];
  if (!limit.mime.includes(mime)) return { ok: false, error: `O formato de "${file.name}" não é aceito.` };
  if (file.size > limit.max_bytes) {
    return { ok: false, error: `"${file.name}" é maior que o limite de ${Math.round(limit.max_bytes / 1024 / 1024)} MB.` };
  }
  if (limit.max_seconds && file.durationSeconds && file.durationSeconds > limit.max_seconds) {
    return { ok: false, error: `"${file.name}" passa do limite de ${Math.round(limit.max_seconds / 60)} minutos.` };
  }
  return { ok: true, kind, mime };
}
