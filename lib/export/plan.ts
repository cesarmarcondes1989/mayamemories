// Plano do ZIP de exportação: nomes legíveis para cada arquivo e divisão em
// partes de tamanho limitado (para cada download caber no tempo do servidor).

export type ExportAsset = {
  id: string;
  memory_id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  media_type: string;
};
export type ExportMemory = { id: string; title: string | null; memory_type: string; occurred_at: string | null; created_at: string };

export type PlannedFile = ExportAsset & { zipPath: string; part: number };
export type ExportPart = { part: number; files: PlannedFile[]; bytes: number; from: string | null; to: string | null };

export const DEFAULT_PART_BYTES = 500 * 1024 * 1024;

const TYPE_DIR: Record<string, string> = { image: "fotos", video: "videos", audio: "audios", document: "documentos" };

export function slugify(s: string, max = 40): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

function extension(a: ExportAsset): string {
  const fromPath = a.storage_path.match(/\.([a-z0-9]{1,5})$/i)?.[1];
  const fromName = a.original_filename?.match(/\.([a-z0-9]{1,5})$/i)?.[1];
  return (fromPath ?? fromName ?? "bin").toLowerCase();
}

/** media/2026/fotos/2026-03-14_primeiro-banho_1a2b3c4d.jpg */
export function zipPathFor(a: ExportAsset, m: ExportMemory | undefined): string {
  const date = (m?.occurred_at ?? m?.created_at ?? "").slice(0, 10) || "sem-data";
  const year = /^\d{4}/.test(date) ? date.slice(0, 4) : "sem-data";
  const title = slugify(m?.title ?? "") || slugify((a.original_filename ?? "").replace(/\.[^.]+$/, "")) || m?.memory_type || "memoria";
  return `media/${year}/${TYPE_DIR[a.media_type] ?? "outros"}/${date}_${title}_${a.id.slice(0, 8)}.${extension(a)}`;
}

/** Ordena por data do momento e reparte sem passar do limite (um arquivo grande sozinho vira uma parte). */
export function planExport(assets: ExportAsset[], memories: ExportMemory[], partBytes = DEFAULT_PART_BYTES): ExportPart[] {
  const byId = new Map(memories.map((m) => [m.id, m]));
  const dateOf = (a: ExportAsset) => {
    const m = byId.get(a.memory_id);
    return (m?.occurred_at ?? m?.created_at ?? "9999").slice(0, 10);
  };
  const sorted = [...assets].sort((a, b) => dateOf(a).localeCompare(dateOf(b)) || a.id.localeCompare(b.id));
  const parts: ExportPart[] = [];
  let current: ExportPart | null = null;
  for (const a of sorted) {
    const size = a.size_bytes ?? 0;
    if (!current || (current.files.length > 0 && current.bytes + size > partBytes)) {
      current = { part: parts.length + 1, files: [], bytes: 0, from: null, to: null };
      parts.push(current);
    }
    const d = dateOf(a);
    current.files.push({ ...a, zipPath: zipPathFor(a, byId.get(a.memory_id)), part: current.part });
    current.bytes += size;
    current.from ??= d === "9999" ? null : d;
    if (d !== "9999") current.to = d;
  }
  // Sempre existe a parte 1 (leva o manifesto e o index.html, mesmo sem mídia)
  if (!parts.length) parts.push({ part: 1, files: [], bytes: 0, from: null, to: null });
  return parts;
}
