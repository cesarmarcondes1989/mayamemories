import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setFamilyMembership, setPersonRole, setPersonStatus, updatePerson } from "@/features/admin/actions";
import { PersonForm } from "@/components/admin/person-form";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { NFC_STATUS_LABELS, ROLE_LABELS, VISIT_TYPE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Pessoa" };

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string; erro?: string; criada?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: person } = await supabase.from("people").select("*").eq("id", id).maybeSingle();
  if (!person) notFound();
  const [{ data: rel }, { data: overview }, { data: invites }, { data: tokens }, { data: visits }, { data: consents }] = await Promise.all([
    supabase.from("relationship_types").select("key, label").order("sort_order"),
    supabase.rpc("admin_people_overview"),
    supabase.from("invitations").select("id, email, expires_at, accepted_at, revoked_at, created_at").eq("person_id", id).order("created_at", { ascending: false }),
    supabase.from("nfc_tokens").select("id, public_id, status, label, created_at").eq("person_id", id).order("created_at", { ascending: false }),
    supabase.from("visits").select("id, occurred_at, visit_type, status").eq("person_id", id).order("occurred_at", { ascending: false }),
    supabase.from("consents").select("consent_type, status, policy_version, created_at").eq("person_id", id).order("created_at", { ascending: false }),
  ]);
  const ov = ((overview ?? []) as Array<{ person_id: string; roles: string[]; in_family: boolean; last_portal_access: string | null; last_contribution: string | null; last_confirmed_visit: string | null; last_interaction: string | null }>).find(
    (o) => o.person_id === id,
  );
  const roles = ov?.roles ?? [];

  return (
    <>
      <PageHeader
        eyebrow={(rel ?? []).find((r) => r.key === person.relationship_type)?.label}
        title={person.display_name}
        description={person.profile_id ? "Conta ativa" : "Ainda não ativou a conta"}
        actions={<ButtonLink href={`/admin/convites?pessoa=${id}`} variant="secondary">Convidar / novo link</ButtonLink>}
      />
      {sp.criada && <div className="mb-4"><Alert tone="success" title="Pessoa adicionada.">Agora envie um convite para que ela possa contribuir.</Alert></div>}
      {sp.salvo && <div className="mb-4"><Alert tone="success">Alterações salvas.</Alert></div>}
      {sp.erro && <div className="mb-4"><Alert tone="error">{sp.erro}</Alert></div>}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Último acesso ao portal", formatDateTime(ov?.last_portal_access)],
          ["Última contribuição", formatDateTime(ov?.last_contribution)],
          ["Última visita confirmada", formatDate(ov?.last_confirmed_visit)],
          ["Última interação", formatDateTime(ov?.last_interaction)],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-taupe">{label}</p>
            <p className="mt-1 text-[15px]">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-2xl">Dados</h2>
          <PersonForm action={updatePerson} relationshipTypes={rel ?? []} person={person} submitLabel="Salvar" />
        </Card>
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-2xl">Permissões</h2>
            {!person.profile_id && <p className="mb-3 text-sm text-taupe">Papéis podem ser atribuídos depois que a pessoa aceitar o convite.</p>}
            <ul className="space-y-2">
              {(["contributor", "admin", "future_subject"] as const).map((role) => {
                const has = roles.includes(role);
                return (
                  <li key={role} className="flex items-center justify-between gap-2">
                    <span className="text-[15px]">{ROLE_LABELS[role]}</span>
                    <form action={setPersonRole}>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="role" value={role} />
                      <input type="hidden" name="enabled" value={has ? "0" : "1"} />
                      <Button size="sm" variant={has ? "secondary" : "soft"} disabled={!person.profile_id}>
                        {has ? "Remover" : "Conceder"}
                      </Button>
                    </form>
                  </li>
                );
              })}
              <li className="flex items-center justify-between gap-2 border-t border-line pt-2">
                <span className="text-[15px]">Grupo “Família autorizada”</span>
                <form action={setFamilyMembership}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="enabled" value={ov?.in_family ? "0" : "1"} />
                  <Button size="sm" variant={ov?.in_family ? "secondary" : "soft"}>{ov?.in_family ? "Remover" : "Incluir"}</Button>
                </form>
              </li>
            </ul>
            <div className="mt-4 flex gap-2 border-t border-line pt-4">
              <form action={setPersonStatus}>
                <input type="hidden" name="id" value={id} />
                {person.status === "suspended" ? (
                  <Button size="sm" variant="secondary" name="status" value="active">Reativar conta</Button>
                ) : (
                  <Button size="sm" variant="danger" name="status" value="suspended">Suspender acesso</Button>
                )}
              </form>
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 text-2xl">Convites e chaveiros</h2>
            <ul className="space-y-1 text-sm">
              {(invites ?? []).map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span>{i.email ?? "Link"} · criado {formatDate(i.created_at)}</span>
                  <Badge tone={i.accepted_at ? "ok" : i.revoked_at ? "neutral" : "pending"}>
                    {i.accepted_at ? "Aceito" : i.revoked_at ? "Revogado" : new Date(i.expires_at) < new Date() ? "Expirado" : "Pendente"}
                  </Badge>
                </li>
              ))}
              {(tokens ?? []).map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <Link href="/admin/tokens" className="hover:underline">🧸 {t.label ?? t.public_id.slice(0, 6) + "…"}</Link>
                  <Badge tone={t.status === "active" ? "ok" : "neutral"}>{NFC_STATUS_LABELS[t.status]}</Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 text-2xl">Visitas</h2>
            {(visits ?? []).length === 0 ? (
              <p className="text-sm text-taupe">Nenhuma visita registrada.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {visits!.map((v) => (
                  <li key={v.id} className="flex justify-between">
                    <span>{formatDate(v.occurred_at)} · {VISIT_TYPE_LABELS[v.visit_type]}</span>
                    <Badge tone={v.status === "approved" ? "ok" : "pending"}>{v.status === "approved" ? "Confirmada" : v.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 text-2xl">Histórico de consentimento</h2>
            <ul className="space-y-1 text-sm">
              {(consents ?? []).map((c, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{c.consent_type} · v{c.policy_version}</span>
                  <span className="text-taupe">{c.status === "granted" ? "Concedido" : "Retirado"} {formatDateTime(c.created_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
