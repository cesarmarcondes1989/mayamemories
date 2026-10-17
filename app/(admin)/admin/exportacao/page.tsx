import type { Metadata } from "next";
import { requireAdmin } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { getExportPlan } from "@/features/admin/export-zip";
import { Card } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";

export const metadata: Metadata = { title: "Exportação" };
export const dynamic = "force-dynamic";

const fmtDay = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : null);

export default async function ExportPage() {
  const { vault } = await requireAdmin();
  const supabase = await createClient();
  const { manifest, parts } = await getExportPlan(supabase, vault.id);
  const totalBytes = parts.reduce((a, p) => a + p.bytes, 0);
  const totalFiles = parts.reduce((a, p) => a + p.files.length, 0);
  const count = (type: string) => parts.reduce((a, p) => a + p.files.filter((f) => f.media_type === type).length, 0);
  const csv = [
    ["people", "Pessoas"],
    ["visits", "Visitas"],
    ["memories", "Memórias"],
    ["comments", "Comentários"],
    ["capsule_items", "Itens de cápsula"],
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Continuidade"
        title="Exportação"
        description="Este é um arquivo de família para décadas. Baixe tudo de vez em quando e guarde cópias fora daqui — num HD externo e numa nuvem sua."
      />

      <Card className="p-6">
        <h2 className="text-3xl">Baixar tudo (ZIP)</h2>
        <p className="mt-1 text-[15px] text-taupe">
          Fotos, vídeos, áudios, cartas, mensagens, comentários e planilhas — com uma página <strong>index.html</strong> que abre
          sem internet e mostra a história inteira, em ordem.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
          {[
            ["Memórias", manifest.memories.length],
            ["Fotos", count("image")],
            ["Vídeos", count("video")],
            ["Áudios", count("audio")],
            ["Tamanho", formatBytes(totalBytes)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-cream px-3 py-2">
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-taupe">{label}</p>
            </div>
          ))}
        </div>

        {parts.length > 1 && (
          <div className="mt-4">
            <Alert tone="info">
              Para não travar no meio do caminho, dividimos em <strong>{parts.length} partes</strong> de até ~500 MB. Baixe todas e
              extraia <strong>na mesma pasta</strong>; depois abra o <code>index.html</code>.
            </Alert>
          </div>
        )}

        <ul className="mt-4 space-y-2">
          {parts.map((p) => (
            <li key={p.part} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {parts.length > 1 ? `Parte ${p.part} de ${parts.length}` : "Pacote completo"}
                  {p.part === 1 && <span className="font-normal text-taupe"> · com index.html e planilhas</span>}
                </p>
                <p className="text-sm text-taupe">
                  {p.files.length} arquivos · {formatBytes(p.bytes)}
                  {p.from && ` · ${fmtDay(p.from)}${p.to && p.to !== p.from ? ` a ${fmtDay(p.to)}` : ""}`}
                </p>
              </div>
              <a href={`/api/admin/export/zip?parte=${p.part}`} className={buttonClasses(p.part === 1 ? "primary" : "secondary", "md")} download>
                ⬇ Baixar {parts.length > 1 ? `parte ${p.part}` : "ZIP"}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-taupe">
          {totalFiles} arquivos no total. Prefira o computador e uma conexão estável (Wi-Fi). Cada download fica registrado na auditoria.
          No iPhone, o ZIP vai para o app Arquivos.
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="text-2xl">Só as planilhas (CSV)</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {csv.map(([k, label]) => (
            <a key={k} href={`/api/admin/export?format=${k}`} className={buttonClasses("secondary", "sm")}>
              {label}
            </a>
          ))}
          <a href="/api/admin/export?format=json" className={buttonClasses("ghost", "sm")}>
            manifest.json (técnico)
          </a>
        </div>
      </Card>
    </div>
  );
}
