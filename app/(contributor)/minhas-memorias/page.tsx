import type { Metadata } from "next";
import { requireMember } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { MEMORY_SELECT, attachMediaUrls, type MemoryRow } from "@/features/memories/queries";
import { MemoryCard } from "@/components/memories/memory-card";
import { Alert, EmptyState, PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { VISIT_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Minhas memórias" };

export default async function MyMemoriesPage({ searchParams }: { searchParams: Promise<{ removida?: string }> }) {
  const viewer = await requireMember();
  const { removida } = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: visits }] = await Promise.all([
    supabase
      .from("memories")
      .select(MEMORY_SELECT)
      .eq("created_by_profile_id", viewer.profileId!)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("visits").select("id, occurred_at, visit_type, status").eq("person_id", viewer.personId!).order("occurred_at", { ascending: false }),
  ]);
  const memories = await attachMediaUrls((data ?? []) as unknown as MemoryRow[], { firstOnly: true });
  const drafts = memories.filter((m) => ["draft", "uploading"].includes(m.moderation_status));
  const rest = memories.filter((m) => !["draft", "uploading"].includes(m.moderation_status));

  return (
    <>
      <PageHeader
        eyebrow="Seu histórico"
        title="Minhas memórias"
        description="Acompanhe o status do que você enviou. Você pode corrigir ou pedir a exclusão quando quiser."
        actions={<ButtonLink href="/enviar/foto">Nova memória</ButtonLink>}
      />
      {removida && (
        <div className="mb-6">
          <Alert tone="success">A memória foi retirada.</Alert>
        </div>
      )}
      {rest.length === 0 && drafts.length === 0 ? (
        <EmptyState title="Nada por aqui ainda" action={<ButtonLink href="/inicio">Fazer minha primeira contribuição</ButtonLink>}>
          Uma foto, um áudio, uma carta — tudo começa com um pequeno gesto.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rest.map((m) => (
            <MemoryCard key={m.id} memory={m} href={`/minhas-memorias/${m.id}`} showStatus showVisibility />
          ))}
        </div>
      )}
      {drafts.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-2xl">Envios não concluídos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {drafts.map((m) => (
              <MemoryCard key={m.id} memory={m} href={`/minhas-memorias/${m.id}`} showStatus />
            ))}
          </div>
        </section>
      )}
      {(visits ?? []).length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-2xl">Minhas visitas</h2>
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-paper">
            {visits!.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[15px]">
                <span>
                  {formatDate(v.occurred_at)} · {VISIT_TYPE_LABELS[v.visit_type]}
                </span>
                <Badge tone={v.status === "approved" ? "ok" : v.status === "pending_review" ? "pending" : "neutral"}>
                  {v.status === "approved" ? "Confirmada" : v.status === "pending_review" ? "Aguardando" : "Não confirmada"}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
