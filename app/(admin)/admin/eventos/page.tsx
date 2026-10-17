import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { createEvent, createTableToken, setEventStatus, updateEvent } from "@/features/events/actions";
import { CopyButton } from "@/components/admin/copy-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert, EmptyState, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { publicEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { TokenQr } from "@/components/tokens/token-qr";

export const metadata: Metadata = { title: "Eventos" };

type EventRow = { id: string; name: string; event_date: string | null; description: string | null; status: "open" | "closed" | "archived" };
type TokenRow = { id: string; public_id: string; label: string | null; status: string; event_id: string; person_id: string | null };

const STATUS = {
  open: { label: "Recebendo convidados", tone: "ok" },
  closed: { label: "Encerrado", tone: "neutral" },
  archived: { label: "Arquivado", tone: "neutral" },
} as const;

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ erro?: string; criado?: string; salvo?: string; token?: string }> }) {
  const V = (await requireAdmin()).vault.id;
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: events, error }, { data: tokens }, { data: guests }, { data: memories }] = await Promise.all([
    supabase.from("vault_events").select("id, name, event_date, description, status").eq("vault_id", V).order("event_date", { ascending: false, nullsFirst: true }),
    supabase.from("nfc_tokens").select("id, public_id, label, status, event_id, person_id").eq("vault_id", V).not("event_id", "is", null).in("status", ["active", "prepared", "suspended"]),
    supabase.from("people").select("joined_event_id").eq("vault_id", V).not("joined_event_id", "is", null),
    supabase.from("memories").select("event_id").eq("vault_id", V).not("event_id", "is", null).is("deleted_at", null),
  ]);
  const count = (rows: Array<Record<string, string | null>> | null, key: string, id: string) => (rows ?? []).filter((r) => r[key] === id).length;
  const site = publicEnv.siteUrl();

  return (
    <>
      <PageHeader
        eyebrow="Momentos especiais"
        title="Eventos"
        description="Chá bar, 1 ano, batizado… Cada evento tem o próprio álbum. Convidados entram pelo token de mesa (NFC ou QR) só dizendo o nome — e veem apenas o álbum daquele evento."
      />
      {error && (
        <div className="mb-4">
          <Alert tone="warn">Os eventos ainda não estão ativos no banco. Aplique a migration 011 no Supabase.</Alert>
        </div>
      )}
      {sp.erro && <div className="mb-4"><Alert tone="error">{sp.erro}</Alert></div>}
      {sp.criado && <div className="mb-4"><Alert tone="success">Evento criado. Copie a URL do token de mesa e grave no NFC (ou gere um QR).</Alert></div>}
      {sp.token && <div className="mb-4"><Alert tone="success">Token de mesa criado.</Alert></div>}
      {sp.salvo && <div className="mb-4"><Alert tone="success">Evento atualizado.</Alert></div>}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit p-5">
          <h2 className="mb-3 text-2xl">Novo evento</h2>
          <form action={createEvent} className="space-y-4">
            <Field label="Nome" htmlFor="name" hint="Ex.: Chá bar, 1 ano da Alice, Batizado">
              <Input id="name" name="name" required maxLength={80} />
            </Field>
            <Field label="Data" htmlFor="eventDate" optional>
              <Input id="eventDate" name="eventDate" type="date" />
            </Field>
            <Field label="Recado para os convidados" htmlFor="description" optional>
              <Textarea id="description" name="description" maxLength={1000} className="min-h-20" placeholder="Mande sua foto preferida da festa ♡" />
            </Field>
            <Checkbox name="tableToken" defaultChecked label="Já criar um token de mesa" hint="Quem encostar o celular entra como convidado, sem cadastro." />
            <SubmitButton>Criar evento</SubmitButton>
          </form>
        </Card>

        <div className="space-y-4">
          {(events ?? []).length === 0 ? (
            <EmptyState title="Nenhum evento ainda">Crie o primeiro: o chá de bebê, o primeiro aniversário…</EmptyState>
          ) : (
            ((events ?? []) as EventRow[]).map((e) => {
              const st = STATUS[e.status];
              const eventTokens = ((tokens ?? []) as TokenRow[]).filter((t) => t.event_id === e.id);
              return (
                <Card key={e.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-4xl">{e.name}</h2>
                      <p className="text-sm text-taupe">
                        {e.event_date ? formatDate(e.event_date) : "Sem data"} · {count(guests, "joined_event_id", e.id)} convidados ·{" "}
                        {count(memories, "event_id", e.id)} memórias
                      </p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  {e.description && <p className="mt-2 text-[15px] text-ink/80">{e.description}</p>}

                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold">Tokens deste evento</p>
                    {eventTokens.length === 0 && <p className="text-sm text-taupe">Nenhum ainda.</p>}
                    {eventTokens.map((t) => {
                      const url = `${site}/m/${t.public_id}`;
                      return (
                        <div key={t.id} className="rounded-2xl bg-cream px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">
                              {t.person_id ? "🧸" : "🍽️"} {t.label ?? (t.person_id ? "Pessoa" : "Mesa")}
                            </span>
                            <Badge tone={t.person_id ? "rose" : "sage"}>{t.person_id ? "Pessoa" : "Impessoal"}</Badge>
                            <code className="min-w-0 flex-1 text-xs break-all text-taupe">{url}</code>
                            <CopyButton text={url} label="Copiar" />
                          </div>
                          <TokenQr tokenId={t.id} url={url} personal={Boolean(t.person_id)} />
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {e.status === "open" && (
                      <form action={createTableToken} className="flex gap-2">
                        <input type="hidden" name="eventId" value={e.id} />
                        <Input name="label" placeholder="Mesa 2" className="h-9 w-28 text-sm" aria-label="Nome do token" />
                        <Button size="sm" variant="soft" type="submit">+ Token de mesa</Button>
                      </form>
                    )}
                    <Link href={`/admin/tokens?evento=${e.id}`} className="text-sm text-rose-deep underline-offset-4 hover:underline">
                      + Token de uma pessoa
                    </Link>
                    <form action={setEventStatus} className="ml-auto">
                      <input type="hidden" name="eventId" value={e.id} />
                      {e.status === "open" ? (
                        <Button size="sm" variant="ghost" name="status" value="closed">Encerrar</Button>
                      ) : (
                        <Button size="sm" variant="secondary" name="status" value="open">Reabrir</Button>
                      )}
                    </form>
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-taupe">Editar</summary>
                    <form action={updateEvent} className="mt-3 grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="eventId" value={e.id} />
                      <Field label="Nome" htmlFor={`n-${e.id}`}>
                        <Input id={`n-${e.id}`} name="name" defaultValue={e.name} required maxLength={80} />
                      </Field>
                      <Field label="Data" htmlFor={`d-${e.id}`} optional>
                        <Input id={`d-${e.id}`} name="eventDate" type="date" defaultValue={e.event_date ?? ""} />
                      </Field>
                      <Field label="Recado" htmlFor={`r-${e.id}`} optional className="sm:col-span-2">
                        <Textarea id={`r-${e.id}`} name="description" defaultValue={e.description ?? ""} className="min-h-20" />
                      </Field>
                      <div>
                        <SubmitButton variant="secondary" pendingText="Salvando…">Salvar</SubmitButton>
                      </div>
                    </form>
                  </details>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
