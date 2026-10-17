import type { Metadata } from "next";
import Link from "next/link";
import { loadStory } from "@/features/story/load";
import { periodLabel } from "@/features/story/build";
import { sectionFor } from "@/features/story/texts";
import { qrSvg } from "@/lib/qr";
import { publicEnv } from "@/lib/env";
import { PrintButton } from "@/components/tokens/print-button";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Livro" };
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TYPE: Record<string, string> = { photo: "Foto", video: "Vídeo", audio: "Áudio", text: "Recado", letter: "Carta", visit: "Visita", milestone: "Marco", drawing: "Desenho", album: "Álbum", mixed: "Memória" };

/** Livro do ano, diagramado automaticamente (21×21 cm). Salvar em PDF pela impressão. */
export default async function BookPage({ params }: { params: Promise<{ periodo: string }> }) {
  const { periodo } = await params;
  const { story, texts, working, rationale, totalAll } = await loadStory(periodo, "book");
  const site = publicEnv.siteUrl();
  const qrs = new Map<string, string>();
  for (const c of story.chapters) for (const i of c.items) {
    if (i.media.some((m) => m.type === "audio" || m.type === "video")) qrs.set(i.id, await qrSvg(`${site}/memoria/${i.id}`));
  }
  const total = story.chapters.reduce((a, c) => a + c.items.length, 0);

  return (
    <div className="book-root">
      <style>{`
        @page { size: 210mm 210mm; margin: 0; }
        .book-root { background: #efe6e8; min-height: 100dvh; padding: 24px 0 80px; }
        .page { width: 210mm; height: 210mm; margin: 0 auto 18px; background: #fffaf7; position: relative; overflow: hidden;
                box-shadow: 0 10px 30px rgba(120,60,80,.18); padding: 16mm; display: flex; flex-direction: column; break-after: page; }
        .page .foot { position: absolute; bottom: 8mm; left: 0; right: 0; text-align: center; font-size: 9pt; color: #b39aa1; }
        .photo { flex: 1; min-height: 0; border-radius: 6mm; overflow: hidden; background: #fbe8ec; display: grid; place-items: center; }
        .photo img { width: 100%; height: 100%; object-fit: contain; }
        @media print {
          .book-root { background: none; padding: 0; }
          .page { margin: 0; box-shadow: none; }
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="no-print mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4">
        <div>
          <p className="font-display text-4xl text-rose-deep">O livro {story.subject === "" ? "" : `de ${story.subject}`}</p>
          <p className="text-sm text-taupe">
            {total} {total === totalAll ? "memórias" : `de ${totalAll} memórias`} · {story.chapters.length} capítulos · montado automaticamente
            {working && " · a família de IAs está escolhendo e escrevendo agora — atualize em 1 ou 2 minutos"}
          </p>
          {rationale && <p className="mt-1 max-w-xl text-xs text-taupe">{rationale}</p>}
          {story.years.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-2 text-sm">
              {[...story.years, "tudo"].map((y) => (
                <Link key={y} href={`/livro/${y}`} className={y === periodo ? "font-bold text-rose-deep" : "text-taupe underline underline-offset-4"}>{y === "tudo" ? "tudo" : y}</Link>
              ))}
              <Link href={`/filme/${periodo}`} className="text-rose-deep underline underline-offset-4">🎬 ver o filme</Link>
            </p>
          )}
        </div>
        <PrintButton />
      </div>

      {total === 0 ? (
        <div className="page items-center justify-center text-center">
          <p className="font-display text-6xl text-rose-deep">Ainda não há memórias aprovadas neste período.</p>
        </div>
      ) : (
        <>
          {/* Capa */}
          <section className="page" style={{ background: "#f6d3da", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            {story.cover && (
              <div style={{ width: "120mm", height: "120mm", borderRadius: "60mm", overflow: "hidden", border: "4mm solid #fffaf7", marginBottom: "8mm" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={story.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <h1 className="font-display" style={{ fontSize: "60pt", color: "#b85a72", lineHeight: 0.9 }}>{story.subject}</h1>
            <p style={{ fontSize: "14pt", color: "#8a5a68", fontWeight: 700 }}>{periodLabel(story.period)}</p>
            <p className="foot" style={{ color: "#a86a7c" }}>guardei pra você ♡</p>
          </section>

          {/* Abertura */}
          <section className="page" style={{ justifyContent: "center" }}>
            <p className="font-hand" style={{ fontSize: "20pt", lineHeight: 1.35, color: "#4a3b40", whiteSpace: "pre-line" }}>{texts.abertura}</p>
          </section>

          {story.chapters.map((c) => (
            <div key={c.key}>
              <section className="page" style={{ justifyContent: "center", background: "#fbe8ec" }}>
                <p style={{ fontSize: "11pt", letterSpacing: "3pt", textTransform: "uppercase", color: "#a86a7c", fontWeight: 800 }}>capítulo</p>
                <h2 className="font-display" style={{ fontSize: "48pt", color: "#b85a72", lineHeight: 1, textTransform: "capitalize" }}>{c.label}</h2>
                <p style={{ marginTop: "8mm", fontSize: "12.5pt", lineHeight: 1.6, color: "#4a3b40", whiteSpace: "pre-line" }}>{texts[sectionFor(c)]}</p>
              </section>
              {c.items.map((i) => {
                const image = i.media.find((m) => m.type === "image");
                return (
                  <section key={i.id} className="page">
                    {image ? (
                      <div className="photo">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.url} alt={i.title ?? ""} />
                      </div>
                    ) : qrs.has(i.id) ? (
                      <div className="photo" style={{ gap: "4mm", alignContent: "center", textAlign: "center" }}>
                        <div style={{ width: "60mm", height: "60mm", background: "#fff", padding: "3mm", borderRadius: "4mm" }} dangerouslySetInnerHTML={{ __html: qrs.get(i.id)! }} />
                        <p style={{ fontSize: "12pt", color: "#8a5a68", fontWeight: 700 }}>
                          {i.media.some((m) => m.type === "audio") ? "🎧 Aponte a câmera para ouvir" : "🎬 Aponte a câmera para assistir"}
                        </p>
                      </div>
                    ) : (
                      <div className="photo" style={{ background: "#fffaf7", border: "0.6mm solid #f1dfe3", padding: "12mm" }}>
                        <p className="font-hand" style={{ fontSize: "22pt", lineHeight: 1.3, color: "#4a3b40", whiteSpace: "pre-line" }}>{i.description}</p>
                      </div>
                    )}
                    <div style={{ marginTop: "6mm" }}>
                      <p className="font-display" style={{ fontSize: "26pt", lineHeight: 1, color: "#4a3b40" }}>{i.title ?? TYPE[i.type] ?? "Memória"}</p>
                      {image && i.description && <p style={{ marginTop: "2mm", fontSize: "11pt", lineHeight: 1.5, color: "#5a4a50" }}>{i.description}</p>}
                      {!image && qrs.has(i.id) && i.description && <p style={{ marginTop: "2mm", fontSize: "11pt", lineHeight: 1.5, color: "#5a4a50" }}>{i.description}</p>}
                      <p style={{ marginTop: "2mm", fontSize: "9.5pt", color: "#a08890" }}>{formatDate(i.date)} · guardado por {i.author}</p>
                      {i.comments.slice(0, 2).map((cm, k) => (
                        <p key={k} style={{ fontSize: "9.5pt", color: "#8a7178", fontStyle: "italic" }}>“{cm.body}” — {cm.author}</p>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ))}

          {/* Quem guardou */}
          <section className="page" style={{ justifyContent: "center", textAlign: "center" }}>
            <h2 className="font-display" style={{ fontSize: "40pt", color: "#b85a72" }}>Quem guardou estas memórias</h2>
            <p style={{ marginTop: "6mm", fontSize: "14pt", lineHeight: 1.8, color: "#4a3b40" }}>{story.contributors.join(" · ")}</p>
            <p className="font-hand" style={{ marginTop: "12mm", fontSize: "18pt", lineHeight: 1.4, color: "#4a3b40", whiteSpace: "pre-line" }}>{texts.fim}</p>
          </section>

          {/* Contracapa */}
          <section className="page" style={{ background: "#d97a92", alignItems: "center", justifyContent: "center", color: "#fffaf7", textAlign: "center" }}>
            <p className="font-display" style={{ fontSize: "44pt" }}>guardei pra você</p>
            <p style={{ fontSize: "11pt" }}>guardeipravoce.com.br</p>
          </section>
        </>
      )}
    </div>
  );
}
