import { requireAdmin } from "@/lib/permissions/viewer";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { VISIT_TYPE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Visitas" };

const STATUS: Record<string, { label: string; tone: "ok" | "pending" | "neutral" | "error" }> = {
  approved: { label: "Confirmada", tone: "ok" },
  pending_review: { label: "Aguardando", tone: "pending" },
  rejected: { label: "Não confirmada", tone: "error" },
  hidden: { label: "Oculta", tone: "neutral" },
  removed: { label: "Removida", tone: "neutral" },
};

export default async function VisitsPage() {
  const V = (await requireAdmin()).vault.id;
  const supabase = await createClient();
  const { data } = await supabase
    .from("visits")
    .select("id, occurred_at, registered_at, visit_type, message, companions, status, memory_id, person:people(id, display_name)").eq("vault_id", V)
    .order("occurred_at", { ascending: false })
    .limit(200);
  const visits = (data ?? []) as unknown as Array<{
    id: string; occurred_at: string; registered_at: string; visit_type: string; message: string | null; companions: string | null;
    status: string; memory_id: string | null; person: { id: string; display_name: string } | null;
  }>;
  return (
    <>
      <PageHeader
        eyebrow="Presença"
        title="Visitas"
        description="Somente registros explícitos. Para confirmar ou corrigir, abra a memória da visita na central de aprovação."
      />
      {visits.length === 0 ? (
        <EmptyState title="Nenhuma visita registrada ainda" />
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-paper">
          {visits.map((v) => (
            <li key={v.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium">
                  <Link href={`/admin/pessoas/${v.person?.id}`} className="hover:underline">{v.person?.display_name}</Link>{" "}
                  <span className="font-normal text-taupe">· {VISIT_TYPE_LABELS[v.visit_type]} · {formatDate(v.occurred_at)}</span>
                </p>
                {v.companions && <p className="text-sm text-taupe">Com {v.companions}</p>}
                {v.message && <p className="mt-1 line-clamp-2 text-[15px]">{v.message}</p>}
                <p className="text-xs text-taupe">Registrada em {formatDateTime(v.registered_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={STATUS[v.status]?.tone ?? "neutral"}>{STATUS[v.status]?.label ?? v.status}</Badge>
                {v.memory_id && (
                  <Link href={`/admin/memorias/${v.memory_id}`} className="text-sm text-rose-deep hover:underline">
                    Revisar
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
