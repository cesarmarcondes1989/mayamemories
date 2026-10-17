import { requireAdmin } from "@/lib/permissions/viewer";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { resendInvitation, revokeInvitation } from "@/features/admin/actions";
import { InviteForm } from "@/components/admin/invite-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Convites" };

export default async function InvitationsPage({ searchParams }: { searchParams: Promise<{ pessoa?: string; erro?: string; reenviado?: string }> }) {
  const V = (await requireAdmin()).vault.id;
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: people }, { data: invites }] = await Promise.all([
    supabase.from("people").select("id, display_name").eq("vault_id", V).in("status", ["invited", "active"]).order("display_name"),
    supabase
      .from("invitations")
      .select("id, email, expires_at, accepted_at, revoked_at, last_sent_at, created_at, person:people(display_name)").eq("vault_id", V)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const now = new Date();
  return (
    <>
      <PageHeader eyebrow="Acesso" title="Convites" description="Convites individuais, de uso único e com validade. O segredo nunca é armazenado em texto puro." />
      {sp.erro && <div className="mb-4"><Alert tone="error">{sp.erro}</Alert></div>}
      {sp.reenviado && <div className="mb-4"><Alert tone="success">Convite reenviado.</Alert></div>}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit p-5">
          <h2 className="mb-3 text-2xl">Novo convite</h2>
          <InviteForm people={people ?? []} defaultPersonId={sp.pessoa} />
        </Card>
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {((invites ?? []) as unknown as Array<{ id: string; email: string | null; expires_at: string; accepted_at: string | null; revoked_at: string | null; last_sent_at: string | null; created_at: string; person: { display_name: string } | null }>).map((i) => {
              const state = i.accepted_at ? "accepted" : i.revoked_at ? "revoked" : new Date(i.expires_at) < now ? "expired" : "pending";
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{i.person?.display_name}</p>
                    <p className="text-sm text-taupe">
                      {i.email ?? "Link sem e-mail"} · criado {formatDate(i.created_at)} · expira {formatDate(i.expires_at)}
                      {i.last_sent_at && ` · enviado ${formatDate(i.last_sent_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={state === "accepted" ? "ok" : state === "pending" ? "pending" : "neutral"}>
                      {{ accepted: "Aceito", revoked: "Revogado", expired: "Expirado", pending: "Pendente" }[state]}
                    </Badge>
                    {state === "pending" && (
                      <>
                        {i.email && (
                          <form action={resendInvitation}>
                            <input type="hidden" name="id" value={i.id} />
                            <Button size="sm" variant="ghost">Reenviar</Button>
                          </form>
                        )}
                        <form action={revokeInvitation}>
                          <input type="hidden" name="id" value={i.id} />
                          <Button size="sm" variant="ghost">Revogar</Button>
                        </form>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
