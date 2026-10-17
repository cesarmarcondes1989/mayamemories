import { requireAdmin } from "@/lib/permissions/viewer";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MEMORY_SELECT, attachMediaUrls, type MemoryRow } from "@/features/memories/queries";
import { bulkApprove, moderateComment, moderateMemory, resolveDeletion } from "@/features/admin/actions";
import { MediaView } from "@/components/memories/media-view";
import { Alert, Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { Badge, PrivacyBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MEMORY_TYPE_LABELS, VISIT_TYPE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Central de aprovação" };

const FILTERS = [
  { key: "", label: "Tudo" },
  { key: "photo", label: "Fotos", types: ["photo", "album", "mixed", "drawing"] },
  { key: "video", label: "Vídeos", types: ["video"] },
  { key: "audio", label: "Áudios", types: ["audio"] },
  { key: "text", label: "Textos", types: ["text", "milestone"] },
  { key: "visit", label: "Visitas", types: ["visit"] },
  { key: "letter", label: "Cartas", types: ["letter"] },
  { key: "comentarios", label: "Comentários" },
  { key: "exclusoes", label: "Pedidos de exclusão" },
] as const;

export default async function ApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; erro?: string; aprovadas?: string; falhas?: string }>;
}) {
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === (sp.filtro ?? "")) ?? FILTERS[0];
  const supabase = await createClient();
  const returnTo = `/admin/aprovacao${filter.key ? `?filtro=${filter.key}` : ""}`;

  return (
    <>
      <PageHeader eyebrow="Moderação" title="Central de aprovação" description="Nada é publicado sem passar por aqui. Aprovar torna visível somente ao público definido." />
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Filtros">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/admin/aprovacao?filtro=${f.key}` : "/admin/aprovacao"}
            className={cn("rounded-full border px-3 py-1.5 text-sm", f.key === filter.key ? "border-rose-deep bg-rose-deep text-white" : "border-line bg-paper text-taupe hover:text-ink")}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {sp.erro && (
        <div className="mb-4">
          <Alert tone="error">{sp.erro}</Alert>
        </div>
      )}
      {sp.aprovadas && (
        <div className="mb-4">
          <Alert tone="success">
            {sp.aprovadas} memória(s) aprovada(s){sp.falhas ? `; ${sp.falhas} não puderam ser aprovadas (arquivos pendentes).` : "."}
          </Alert>
        </div>
      )}
      {filter.key === "comentarios" ? (
        <CommentsQueue supabase={supabase} />
      ) : filter.key === "exclusoes" ? (
        <DeletionQueue supabase={supabase} />
      ) : (
        <MemoryQueue supabase={supabase} types={"types" in filter ? [...filter.types] : null} returnTo={returnTo} />
      )}
    </>
  );
}

type Sb = Awaited<ReturnType<typeof createClient>>;

async function MemoryQueue({ supabase, types, returnTo }: { supabase: Sb; types: string[] | null; returnTo: string }) {
  const V = (await requireAdmin()).vault.id;
  let q = supabase
    .from("memories")
    .select(MEMORY_SELECT + ", requested_capsule:capsules!memories_requested_capsule_fk(title), visits(occurred_at, visit_type, companions)").eq("vault_id", V)
    .eq("moderation_status", "pending_review")
    .is("deleted_at", null)
    .order("submitted_at", { ascending: true })
    .limit(50);
  if (types) q = q.in("memory_type", types);
  const { data } = await q;
  const memories = await attachMediaUrls((data ?? []) as unknown as MemoryRow[]);
  if (!memories.length) return <EmptyState title="Tudo em dia ♡">Não há memórias aguardando aprovação.</EmptyState>;

  return (
    <div className="space-y-4">
      <form id="bulk" action={bulkApprove} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
        <span className="text-sm text-taupe">Selecione itens já revisados para aprovar em lote.</span>
        <Button size="sm" type="submit">
          Aprovar selecionados
        </Button>
      </form>
      {memories.map((m) => {
        const extra = m as MemoryRow & {
          requested_capsule: { title: string } | null;
          visits: Array<{ occurred_at: string; visit_type: string; companions: string | null }>;
        };
        const visit = extra.visits?.[0];
        return (
          <Card key={m.id} className="overflow-hidden">
            <div className="grid gap-0 md:grid-cols-[minmax(0,320px)_1fr]">
              <div className="space-y-2 bg-cream p-3">
                {m.media_assets.length ? (
                  m.media_assets.map((a) => <MediaView key={a.id} asset={a} compact />)
                ) : (
                  <div className={cn("p-4 text-[15px]", m.memory_type === "letter" && "letter-body text-base")}>
                    {m.description?.slice(0, 600)}
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-taupe">
                    <input type="checkbox" name="ids" value={m.id} form="bulk" className="size-4 accent-[var(--rose-deep)]" />
                    Selecionar
                  </label>
                  <Badge>{MEMORY_TYPE_LABELS[m.memory_type]}</Badge>
                  <PrivacyBadge visibility={m.visibility} />
                  {extra.requested_capsule && <Badge tone="sage">Cápsula sugerida: {extra.requested_capsule.title}</Badge>}
                </div>
                {m.title && <h3 className="text-2xl">{m.title}</h3>}
                {m.description && m.media_assets.length > 0 && <p className="mt-1 text-[15px] whitespace-pre-wrap">{m.description}</p>}
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-taupe">Autor</dt>
                  <dd className="flex items-center gap-2">
                    <Avatar name={m.author?.display_name ?? "?"} size="sm" /> {m.author?.display_name}
                  </dd>
                  <dt className="text-taupe">Enviada</dt>
                  <dd>{formatDateTime(m.submitted_at)}</dd>
                  <dt className="text-taupe">Aconteceu</dt>
                  <dd>{formatDate(m.occurred_at)}</dd>
                  {m.unlock_at && (
                    <>
                      <dt className="text-taupe">Abre em</dt>
                      <dd>{formatDate(m.unlock_at)}</dd>
                    </>
                  )}
                  {visit && (
                    <>
                      <dt className="text-taupe">Visita</dt>
                      <dd>
                        {VISIT_TYPE_LABELS[visit.visit_type]} · {formatDate(visit.occurred_at)}
                        {visit.companions && ` · com ${visit.companions}`}
                      </dd>
                    </>
                  )}
                </dl>
                <form action={moderateMemory} className="mt-4 space-y-3">
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <label htmlFor={`note-${m.id}`} className="sr-only">
                    Recado ao autor
                  </label>
                  <input
                    id={`note-${m.id}`}
                    name="note"
                    placeholder="Recado ao autor (opcional, usado ao pedir ajuste ou rejeitar)"
                    className="h-10 w-full rounded-full border border-line bg-paper px-4 text-sm"
                    maxLength={2000}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" name="action" value="approve">
                      Aprovar
                    </Button>
                    <Button size="sm" variant="secondary" name="action" value="request_changes">
                      Solicitar ajuste
                    </Button>
                    <Button size="sm" variant="secondary" name="action" value="hide">
                      Ocultar
                    </Button>
                    <Button size="sm" variant="secondary" name="action" value="reject">
                      Rejeitar
                    </Button>
                    <Button size="sm" variant="danger" name="action" value="remove">
                      Excluir
                    </Button>
                    <Link href={`/admin/memorias/${m.id}`} className="ml-auto self-center text-sm text-rose-deep hover:underline">
                      Editar detalhes
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

async function CommentsQueue({ supabase }: { supabase: Sb }) {
  const V = (await requireAdmin()).vault.id;
  const { data } = await supabase
    .from("memory_comments")
    .select("id, body, created_at, memory_id, author:people!memory_comments_author_person_id_fkey(display_name), memory:memories(title)").eq("vault_id", V)
    .eq("status", "pending_review")
    .is("deleted_at", null)
    .order("created_at");
  const comments = (data ?? []) as unknown as Array<{
    id: string;
    body: string;
    created_at: string;
    memory_id: string;
    author: { display_name: string } | null;
    memory: { title: string | null } | null;
  }>;
  if (!comments.length) return <EmptyState title="Nenhum comentário pendente" />;
  return (
    <ul className="space-y-3">
      {comments.map((c) => (
        <li key={c.id}>
          <Card className="p-4">
            <p className="text-sm text-taupe">
              {c.author?.display_name} em{" "}
              <Link className="underline" href={`/admin/memorias/${c.memory_id}`}>
                {c.memory?.title ?? "memória"}
              </Link>{" "}
              · {formatDateTime(c.created_at)}
            </p>
            <p className="mt-2 whitespace-pre-wrap">{c.body}</p>
            <form action={moderateComment} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="id" value={c.id} />
              <Button size="sm" name="action" value="approve">
                Aprovar
              </Button>
              <Button size="sm" variant="secondary" name="action" value="hide">
                Ocultar
              </Button>
              <Button size="sm" variant="danger" name="action" value="remove">
                Remover
              </Button>
            </form>
          </Card>
        </li>
      ))}
    </ul>
  );
}

async function DeletionQueue({ supabase }: { supabase: Sb }) {
  const V = (await requireAdmin()).vault.id;
  const { data } = await supabase
    .from("data_deletion_requests")
    .select("id, reason, created_at, memory_id, requester:profiles!data_deletion_requests_requested_by_fkey(display_name), memory:memories(title)").eq("vault_id", V)
    .eq("status", "pending")
    .order("created_at");
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    reason: string | null;
    created_at: string;
    memory_id: string | null;
    requester: { display_name: string } | null;
    memory: { title: string | null } | null;
  }>;
  if (!rows.length) return <EmptyState title="Nenhum pedido de exclusão" />;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id}>
          <Card className="p-4">
            <p className="text-[15px]">
              <strong>{r.requester?.display_name}</strong> pediu a exclusão de{" "}
              {r.memory_id ? (
                <Link className="underline" href={`/admin/memorias/${r.memory_id}`}>
                  {r.memory?.title ?? "uma memória"}
                </Link>
              ) : (
                "dados pessoais"
              )}{" "}
              · {formatDateTime(r.created_at)}
            </p>
            {r.reason && <p className="mt-2 text-taupe">“{r.reason}”</p>}
            <form action={resolveDeletion} className="mt-3 flex gap-2">
              <input type="hidden" name="id" value={r.id} />
              <Button size="sm" variant="danger" name="accept" value="1">
                Excluir memória e arquivos
              </Button>
              <Button size="sm" variant="secondary" name="accept" value="0">
                Recusar
              </Button>
            </form>
          </Card>
        </li>
      ))}
    </ul>
  );
}
