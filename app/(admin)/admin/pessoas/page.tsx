import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/permissions/viewer";
import { Avatar, PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Pessoas" };

type Row = {
  person_id: string;
  display_name: string;
  relationship_type: string;
  status: string;
  has_account: boolean;
  roles: string[];
  in_family: boolean;
  last_portal_access: string | null;
  last_contribution: string | null;
  last_confirmed_visit: string | null;
  last_interaction: string | null;
  pending_invitation: boolean;
};

export default async function PeoplePage() {
  const { vault } = await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: rel }] = await Promise.all([
    supabase.rpc("admin_people_overview", { p_vault_id: vault.id }),
    supabase.from("relationship_types").select("key, label"),
  ]);
  const labels = new Map((rel ?? []).map((r) => [r.key, r.label]));
  const rows = (data ?? []) as Row[];
  return (
    <>
      <PageHeader
        eyebrow="Família e amigos"
        title="Pessoas"
        description="Acesso ao portal, contribuição e visita presencial são indicadores diferentes — e nunca viram ranking."
        actions={<ButtonLink href="/admin/pessoas/nova">Adicionar pessoa</ButtonLink>}
      />
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-paper">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-line text-taupe">
            <tr>
              <th className="px-4 py-3 font-medium">Pessoa</th>
              <th className="px-4 py-3 font-medium">Situação</th>
              <th className="px-4 py-3 font-medium">Último acesso</th>
              <th className="px-4 py-3 font-medium">Última contribuição</th>
              <th className="px-4 py-3 font-medium">Última visita confirmada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.person_id} className="hover:bg-cream/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/pessoas/${r.person_id}`} className="flex items-center gap-3">
                    <Avatar name={r.display_name} size="sm" />
                    <span>
                      <span className="block font-medium text-ink">{r.display_name}</span>
                      <span className="text-taupe">{labels.get(r.relationship_type) ?? r.relationship_type}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {r.status !== "active" && <Badge tone={r.status === "invited" ? "pending" : "neutral"}>{r.status === "invited" ? "Convidada" : r.status}</Badge>}
                    {r.roles.map((role) => (
                      <Badge key={role} tone={role === "admin" ? "rose" : "neutral"}>{ROLE_LABELS[role]}</Badge>
                    ))}
                    {r.in_family && <Badge tone="sage">Família</Badge>}
                    {r.pending_invitation && <Badge tone="pending">Convite pendente</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-taupe">{formatDateTime(r.last_portal_access)}</td>
                <td className="px-4 py-3 text-taupe">{formatDateTime(r.last_contribution)}</td>
                <td className="px-4 py-3 text-taupe">{formatDate(r.last_confirmed_visit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
