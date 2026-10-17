import { requireAdmin } from "@/lib/permissions/viewer";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createNfcToken, linkNfcToPerson, replaceNfcToken, setNfcStatus } from "@/features/admin/actions";
import { CopyButton } from "@/components/admin/copy-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmAction } from "@/components/ui/confirm-form";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { NFC_STATUS_LABELS } from "@/lib/constants";
import { publicEnv } from "@/lib/env";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Tokens NFC" };

export default async function TokensPage({ searchParams }: { searchParams: Promise<{ erro?: string; criado?: string; substituido?: string; vinculado?: string; evento?: string }> }) {
  const V = (await requireAdmin()).vault.id;
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: tokens }, { data: people }, { data: events }] = await Promise.all([
    supabase
      .from("nfc_tokens")
      .select("id, public_id, label, status, notes, created_at, activated_at, revoked_at, last_scanned_at, replaced_by_token_id, event_id, person:people(display_name)").eq("vault_id", V)
      .order("created_at", { ascending: false }),
    supabase.from("people").select("id, display_name").eq("vault_id", V).neq("status", "archived").order("display_name"),
    supabase.from("vault_events").select("id, name, status").eq("vault_id", V).neq("status", "archived").order("created_at", { ascending: false }),
  ]);
  const eventName = new Map((events ?? []).map((e) => [e.id, e.name]));
  const site = publicEnv.siteUrl();
  type Token = { id: string; public_id: string; label: string | null; status: string; notes: string | null; created_at: string; activated_at: string | null; revoked_at: string | null; last_scanned_at: string | null; event_id: string | null; person: { display_name: string } | null };

  return (
    <>
      <PageHeader
        eyebrow="Lembrancinhas"
        title="Tokens NFC"
        description="Cada coração guarda apenas uma URL com um identificador aleatório. Ele abre a porta — não concede acesso, e abrir não registra visita."
      />
      {sp.erro && <div className="mb-4"><Alert tone="error">{sp.erro}</Alert></div>}
      {sp.vinculado && <div className="mb-4"><Alert tone="success">Ursinho vinculado. Agora ele abre direto como essa pessoa.</Alert></div>}
      {sp.substituido && <div className="mb-4"><Alert tone="success">Token substituído. Grave a nova URL no chaveiro novo — as memórias da pessoa continuam intactas.</Alert></div>}
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit p-5">
          <h2 className="mb-3 text-2xl">Novo token</h2>
          <form action={createNfcToken} className="space-y-4">
            <Field label="Evento" htmlFor="eventId" optional hint="Ligado a um evento, o token leva direto ao álbum dele.">
              <Select id="eventId" name="eventId" defaultValue={sp.evento ?? ""}>
                <option value="">Nenhum (dia a dia)</option>
                {(events ?? []).map((e) => (
                  <option key={e.id} value={e.id}>{e.name}{e.status !== "open" ? " (encerrado)" : ""}</option>
                ))}
              </Select>
            </Field>
            <Field label="Pessoa" htmlFor="personId" hint="Pessoa: abre direto como ela. Impessoal: qualquer convidado do evento entra dizendo o nome.">
              <Select id="personId" name="personId" required defaultValue={sp.evento ? "guest" : ""}>
                <option value="" disabled>Escolha…</option>
                {(events ?? []).length > 0 && <option value="guest">🍽️ Impessoal — convidados do evento (mesa)</option>}
                {(people ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
                <option value="campaign">— Sem dono (campanha, pede e-mail) —</option>
              </Select>
            </Field>
            <Field label="Nome" htmlFor="label" optional>
              <Input id="label" name="label" placeholder="Ursinho da Vovó" />
            </Field>
            <Checkbox name="activate" defaultChecked label="Ativar imediatamente" hint="Desmarque para preparar antes de entregar." />
            <SubmitButton>Criar token</SubmitButton>
          </form>
          <p className="mt-4 text-xs text-taupe">
            Grave a URL com qualquer app de NFC (ex.: NFC Tools) como registro “URL”. NTAG213 comporta a URL com folga. Bloqueie a etiqueta contra regravação após testar.
          </p>
        </Card>
        <div className="space-y-3">
          {((tokens ?? []) as unknown as Token[]).map((t) => {
            const url = `${site}/m/${t.public_id}`;
            return (
              <Card key={t.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {t.person || !t.event_id ? "🧸" : "🍽️"} {t.label ?? "Sem nome"}{" "}
                      {t.person && <span className="font-normal text-taupe">· {t.person.display_name}</span>}
                      {!t.person && t.event_id && <span className="font-normal text-taupe">· impessoal</span>}
                      {t.event_id && <span className="font-normal text-rose-deep"> · {eventName.get(t.event_id) ?? "evento"}</span>}
                    </p>
                    <code className="mt-1 block text-xs break-all text-taupe">{url}</code>
                    <p className="mt-1 text-xs text-taupe">
                      Criado {formatDate(t.created_at)}
                      {t.activated_at && ` · ativado ${formatDate(t.activated_at)}`}
                      {t.revoked_at && ` · encerrado ${formatDate(t.revoked_at)}`}
                      {t.last_scanned_at && ` · último uso ${formatDateTime(t.last_scanned_at)}`}
                    </p>
                    {t.notes && <p className="mt-1 text-xs text-taupe">{t.notes}</p>}
                  </div>
                  <Badge tone={t.status === "active" ? "ok" : t.status === "prepared" ? "pending" : "neutral"}>{NFC_STATUS_LABELS[t.status]}</Badge>
                </div>
                {!t.person && !t.event_id && !["revoked", "replaced"].includes(t.status) && (
                  <form action={linkNfcToPerson} className="mt-3 flex flex-wrap gap-2 rounded-xl bg-amber-soft p-3">
                    <input type="hidden" name="id" value={t.id} />
                    <span className="w-full text-sm text-[#7a5b26]">Sem dono: este ursinho ainda não abre direto.</span>
                    <Select name="personId" className="h-10 flex-1" aria-label="Pessoa" required defaultValue="">
                      <option value="" disabled>Vincular a…</option>
                      {(people ?? []).map((p) => (
                        <option key={p.id} value={p.id}>{p.display_name}</option>
                      ))}
                    </Select>
                    <Button size="sm" type="submit">Vincular</Button>
                  </form>
                )}
                {!["revoked", "replaced"].includes(t.status) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <CopyButton text={url} label="Copiar URL" />
                    <form action={setNfcStatus}>
                      <input type="hidden" name="id" value={t.id} />
                      {t.status === "active" ? (
                        <Button size="sm" variant="ghost" name="status" value="suspended">Suspender</Button>
                      ) : (
                        <Button size="sm" variant="soft" name="status" value="active">Ativar</Button>
                      )}
                    </form>
                    <ConfirmAction
                      action={replaceNfcToken}
                      hidden={{ id: t.id }}
                      variant="secondary"
                      label="Chaveiro perdido: substituir"
                      title="Substituir este token?"
                      description="O token atual deixa de funcionar e um novo é criado para a mesma pessoa. Nada do que ela registrou é perdido."
                      confirmLabel="Substituir"
                    />
                    <ConfirmAction
                      action={setNfcStatus}
                      hidden={{ id: t.id, status: "revoked" }}
                      label="Revogar"
                      title="Revogar definitivamente?"
                      description="Um token revogado não pode ser reativado."
                      confirmLabel="Revogar"
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
