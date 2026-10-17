import { requireAdmin } from "@/lib/permissions/viewer";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Auditoria" };

const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ p?: string; tipo?: string }> }) {
  const V = (await requireAdmin()).vault.id;
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.p ?? 0) || 0);
  const supabase = await createClient();
  let q = supabase
    .from("audit_events")
    .select("id, action, resource_type, resource_id, metadata, created_at, actor:profiles(display_name)").eq("vault_id", V)
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (sp.tipo && /^[a-z_]+$/.test(sp.tipo)) q = q.eq("resource_type", sp.tipo);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Array<{
    id: number; action: string; resource_type: string; resource_id: string | null; metadata: Record<string, unknown>; created_at: string; actor: { display_name: string } | null;
  }>;
  const types = ["memories", "people", "person_roles", "invitations", "nfc_tokens", "capsules", "capsule_items", "access_grants", "consents", "export"];
  return (
    <>
      <PageHeader eyebrow="Registro imutável" title="Auditoria" description="Ações relevantes ficam registradas sem conteúdo sensível. Ninguém — nem administradores — pode alterar este log." />
      <nav className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/auditoria" className="rounded-full border border-line bg-paper px-3 py-1">Tudo</Link>
        {types.map((t) => (
          <Link key={t} href={`/admin/auditoria?tipo=${t}`} className={`rounded-full border px-3 py-1 ${sp.tipo === t ? "border-rose-deep bg-rose-deep text-white" : "border-line bg-paper"}`}>
            {t}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-paper">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-taupe">
            <tr>
              <th className="px-4 py-2 font-medium">Quando</th>
              <th className="px-4 py-2 font-medium">Quem</th>
              <th className="px-4 py-2 font-medium">Ação</th>
              <th className="px-4 py-2 font-medium">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-4 py-2 whitespace-nowrap text-taupe">{formatDateTime(r.created_at)}</td>
                <td className="px-4 py-2">{r.actor?.display_name ?? "Sistema"}</td>
                <td className="px-4 py-2">
                  <code>{r.action}</code>
                  {r.resource_id && <span className="block text-xs text-taupe">{r.resource_id.slice(0, 8)}…</span>}
                </td>
                <td className="px-4 py-2 text-xs text-taupe">
                  <code className="break-all">{Object.keys(r.metadata ?? {}).length ? JSON.stringify(r.metadata) : "—"}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between text-sm">
        {page > 0 ? <Link href={`/admin/auditoria?p=${page - 1}${sp.tipo ? `&tipo=${sp.tipo}` : ""}`}>← Mais recentes</Link> : <span />}
        {rows.length === PAGE && <Link href={`/admin/auditoria?p=${page + 1}${sp.tipo ? `&tipo=${sp.tipo}` : ""}`}>Mais antigos →</Link>}
      </div>
    </>
  );
}
