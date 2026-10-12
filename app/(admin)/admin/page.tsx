import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Stat } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Painel" };

type Stats = {
  people: number;
  active_people: number;
  pending_invitations: number;
  confirmed_visits: number;
  pending_review: number;
  pending_comments: number;
  pending_deletions: number;
  photos_videos: number;
  future_letters: number;
  open_capsules: number;
  next_capsules: Array<{ id: string; title: string; opens_at: string }>;
  failed_uploads: number;
  storage_bytes: number;
  recent_admin_activity: Array<{ action: string; resource_type: string; created_at: string; actor: string | null }>;
};

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_dashboard_stats");
  const s = data as Stats;
  return (
    <>
      <PageHeader eyebrow="Visão geral" title="Painel" description="Acessos ao portal não são visitas: cada indicador é contado separadamente." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Aguardando aprovação" value={s.pending_review + s.pending_comments} hint={`${s.pending_comments} comentários`} href="/admin/aprovacao" />
        <Stat label="Pessoas" value={s.people} hint={`${s.active_people} com conta ativa`} href="/admin/pessoas" />
        <Stat label="Convites pendentes" value={s.pending_invitations} href="/admin/convites" />
        <Stat label="Visitas confirmadas" value={s.confirmed_visits} href="/admin/visitas" />
        <Stat label="Fotos e vídeos" value={s.photos_videos} />
        <Stat label="Cartas futuras" value={s.future_letters} hint="Ainda lacradas" />
        <Stat label="Cápsulas abertas" value={s.open_capsules} href="/admin/capsulas" />
        <Stat label="Armazenamento" value={formatBytes(s.storage_bytes)} />
      </div>
      {(s.failed_uploads > 0 || s.pending_deletions > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {s.failed_uploads > 0 && <Stat label="Uploads com erro" value={s.failed_uploads} hint="Arquivos reprovados na verificação" />}
          {s.pending_deletions > 0 && <Stat label="Pedidos de exclusão" value={s.pending_deletions} href="/admin/aprovacao?filtro=exclusoes" />}
        </div>
      )}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-2xl">Próximas cápsulas</h2>
          {s.next_capsules.length === 0 ? (
            <p className="text-taupe">Nenhuma cápsula programada.</p>
          ) : (
            <ul className="divide-y divide-line">
              {s.next_capsules.map((c) => (
                <li key={c.id} className="flex justify-between gap-3 py-2 text-[15px]">
                  <Link href={`/admin/capsulas/${c.id}`} className="hover:underline">
                    {c.title}
                  </Link>
                  <span className="text-taupe">{formatDate(c.opens_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-2xl">Últimas atividades administrativas</h2>
          <ul className="divide-y divide-line text-sm">
            {s.recent_admin_activity.map((a, i) => (
              <li key={i} className="flex justify-between gap-3 py-2">
                <span>
                  <span className="text-ink">{a.actor ?? "Sistema"}</span> <span className="text-taupe">· {a.action}</span>
                </span>
                <span className="shrink-0 text-taupe">{formatDateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
          <Link href="/admin/auditoria" className="mt-3 inline-block text-sm text-rose-deep hover:underline">
            Ver auditoria completa →
          </Link>
        </Card>
      </div>
      <p className="mt-6 text-sm text-taupe">Estado dos backups: consulte docs/backup.md — os backups rodam fora da aplicação.</p>
    </>
  );
}
