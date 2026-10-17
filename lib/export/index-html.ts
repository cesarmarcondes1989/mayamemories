// Página offline (index.html) que vai dentro do ZIP: abre em qualquer
// navegador, sem internet, e mostra a história inteira com as mídias.

type Person = { id: string; display_name: string };
type Memory = {
  id: string; title: string | null; description: string | null; memory_type: string; author_person_id: string;
  occurred_at: string | null; created_at: string; unlock_at: string | null; recipient: string | null;
  moderation_status: string; deleted_at: string | null;
};
type Comment = { memory_id: string; author_person_id: string; body: string; status: string };
type Media = { memory_id: string; media_type: string; zipPath: string; original_filename: string | null };

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const TYPE: Record<string, string> = {
  photo: "Foto", album: "Álbum", video: "Vídeo", audio: "Áudio", text: "Mensagem", letter: "Carta", visit: "Visita",
  milestone: "Marco", drawing: "Desenho", mixed: "Memória",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function buildIndexHtml(input: {
  title: string;
  exportedAt: string;
  people: Person[];
  memories: Memory[];
  comments: Comment[];
  media: Media[];
  parts: number;
}): string {
  const names = new Map(input.people.map((p) => [p.id, p.display_name]));
  const mediaBy = new Map<string, Media[]>();
  for (const m of input.media) mediaBy.set(m.memory_id, [...(mediaBy.get(m.memory_id) ?? []), m]);
  const commentsBy = new Map<string, Comment[]>();
  for (const c of input.comments.filter((c) => c.status === "approved")) commentsBy.set(c.memory_id, [...(commentsBy.get(c.memory_id) ?? []), c]);

  const memories = input.memories
    .filter((m) => !m.deleted_at && !["removed", "rejected", "draft"].includes(m.moderation_status))
    .sort((a, b) => (a.occurred_at ?? a.created_at).localeCompare(b.occurred_at ?? b.created_at));

  let year = "";
  const items = memories.map((m) => {
    const date = m.occurred_at ?? m.created_at;
    const y = date.slice(0, 4);
    const header = y !== year ? `<h2 class="year">${esc(y)}</h2>` : "";
    year = y;
    const files = (mediaBy.get(m.id) ?? []).map((f) => {
      const src = esc(f.zipPath);
      if (f.media_type === "image") return `<a href="${src}"><img src="${src}" loading="lazy" alt=""></a>`;
      if (f.media_type === "video") return `<video controls preload="none" src="${src}"></video>`;
      if (f.media_type === "audio") return `<audio controls preload="none" src="${src}"></audio>`;
      return `<a class="file" href="${src}">📎 ${esc(f.original_filename ?? "arquivo")}</a>`;
    });
    const comments = (commentsBy.get(m.id) ?? [])
      .map((c) => `<p class="comment"><b>${esc(names.get(c.author_person_id) ?? "Alguém")}:</b> ${esc(c.body)}</p>`)
      .join("");
    const letter = m.memory_type === "letter" && m.unlock_at
      ? `<p class="lock">✉️ Carta${m.recipient ? ` para ${esc(m.recipient)}` : ""} — para abrir em ${fmtDate(m.unlock_at)}</p>`
      : "";
    return `${header}<article>
  <p class="meta">${fmtDate(date)} · ${esc(TYPE[m.memory_type] ?? "Memória")} · por ${esc(names.get(m.author_person_id) ?? "—")}</p>
  ${m.title ? `<h3>${esc(m.title)}</h3>` : ""}${letter}
  ${m.description ? `<p class="text">${esc(m.description).replace(/\n/g, "<br>")}</p>` : ""}
  ${files.length ? `<div class="media">${files.join("")}</div>` : ""}
  ${comments}
</article>`;
  });

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(input.title)}</title>
<style>
:root{--bg:#fdf3f4;--paper:#fffafa;--rose:#d97a92;--ink:#4a3b40;--muted:#8a7178;--line:#f1dfe3}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 16px 80px}
h1{font-size:40px;line-height:1.1;color:var(--rose);margin:0}
.intro{color:var(--muted)}
.year{margin:48px 0 8px;font-size:28px;color:var(--rose);border-bottom:2px solid var(--line)}
article{background:var(--paper);border:1px solid var(--line);border-radius:24px;padding:16px 20px;margin:16px 0}
h3{margin:4px 0;font-size:20px}.meta{margin:0;font-size:13px;color:var(--muted)}
.text{white-space:normal}.lock{color:var(--rose);font-weight:600}
.media{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-top:8px}
.media img,.media video{width:100%;border-radius:16px;background:#eee}.media audio{width:100%}
.file{display:block}.comment{margin:8px 0 0;font-size:14px;border-left:3px solid var(--line);padding-left:10px}
</style></head><body><main>
<h1>${esc(input.title)}</h1>
<p class="intro">${memories.length} memórias · exportado em ${fmtDate(input.exportedAt)}.${input.parts > 1 ? ` Extraia as ${input.parts} partes do ZIP na <b>mesma pasta</b> para ver todas as fotos e vídeos.` : ""}</p>
${items.join("\n")}
</main></body></html>`;
}
