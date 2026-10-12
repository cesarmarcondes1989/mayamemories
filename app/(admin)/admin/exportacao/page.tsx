import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Exportação" };

export default function ExportPage() {
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
        description="Este é um arquivo de família para décadas. Exporte com frequência e guarde cópias independentes, fora deste provedor."
      />
      <Card className="p-6">
        <h2 className="text-2xl">Pacote completo (JSON)</h2>
        <p className="mt-1 text-[15px] text-taupe">
          Manifesto com pessoas, visitas, memórias, comentários, cápsulas, consentimentos e permissões — autores, datas e vínculos preservados. Cada exportação fica registrada na auditoria.
        </p>
        <a href="/api/admin/export?format=json" className={buttonClasses("primary", "md", "mt-4")}>
          Baixar manifest.json
        </a>
      </Card>
      <Card className="p-6">
        <h2 className="text-2xl">Planilhas (CSV)</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {csv.map(([k, label]) => (
            <a key={k} href={`/api/admin/export?format=${k}`} className={buttonClasses("secondary", "sm")}>
              {label}
            </a>
          ))}
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="text-2xl">Arquivos de mídia</h2>
        <p className="mt-1 text-[15px] text-taupe">
          Fotos, vídeos e áudios são baixados por um script executado no seu computador (não pelo navegador), que monta a estrutura
          <code className="mx-1">maya-memories-export/</code> com <code>manifest.json</code>, <code>media/</code> e <code>README.txt</code>:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-ink p-4 text-xs text-paper">
{`SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \\
  npm run export:media -- ./maya-memories-export`}
        </pre>
        <p className="mt-2 text-sm text-taupe">Detalhes em docs/backup.md (inclui backup do banco e teste de restauração).</p>
      </Card>
    </div>
  );
}
