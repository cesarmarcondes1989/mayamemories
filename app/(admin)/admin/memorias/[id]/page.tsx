import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemory, listComments } from "@/features/memories/queries";
import { grantAccess, moderateComment, moderateMemory, revokeAccess, setMemoryCapsules, updateMemoryAdmin } from "@/features/admin/actions";
import { MediaView } from "@/components/memories/media-view";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert, PageHeader } from "@/components/ui/misc";
import { PrivacyBadge, StatusBadge } from "@/components/ui/badge";
import { MEMORY_TYPE_LABELS, VISIBILITY_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Editar memória" };

export default async function AdminMemoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string; erro?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const memory = await getMemory(id);
  if (!memory) notFound();
  const supabase = await createClient();
  const [{ data: capsules }, { data: grants }, { data: people }, comments] = await Promise.all([
    supabase.from("capsules").select("id, title, status").neq("status", "archived").order("opens_at", { nullsFirst: true }),
    supabase.from("access_grants").select("id, grantee_profile_id, created_at").eq("resource_type", "memory").eq("resource_id", id).is("revoked_at", null),
    supabase.from("people").select("id, display_name, profile_id").not("profile_id", "is", null).order("display_name"),
    listComments(id),
  ]);
  const inCapsules = new Set(memory.capsule_items.map((c) => c.capsule_id));
  const nameByProfile = new Map((people ?? []).map((p) => [p.profile_id, p.display_name]));
  const returnTo = `/admin/memorias/${id}`;

  return (
    <>
      <PageHeader
        eyebrow={MEMORY_TYPE_LABELS[memory.memory_type]}
        title={memory.title ?? "Sem título"}
        description={`Por ${memory.author?.display_name ?? "—"} · registrada em ${formatDateTime(memory.created_at)}`}
        actions={
          <div className="flex gap-2">
            <StatusBadge status={memory.moderation_status} />
            <PrivacyBadge visibility={memory.visibility} />
          </div>
        }
      />
      {sp.salvo && <div className="mb-4"><Alert tone="success">Alterações salvas e registradas na auditoria.</Alert></div>}
      {sp.erro && <div className="mb-4"><Alert tone="error">{sp.erro}</Alert></div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {memory.media_assets.map((a) => (
            <MediaView key={a.id} asset={a} />
          ))}
          <Card className="p-5">
            <form action={updateMemoryAdmin} className="space-y-4">
              <input type="hidden" name="id" value={memory.id} />
              <Field label="Título" htmlFor="title" optional>
                <Input id="title" name="title" defaultValue={memory.title ?? ""} />
              </Field>
              <Field label="Descrição" htmlFor="description" optional>
                <Textarea id="description" name="description" defaultValue={memory.description ?? ""} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Data do acontecimento" htmlFor="occurredAt" optional>
                  <Input id="occurredAt" name="occurredAt" type="date" defaultValue={memory.occurred_at ?? ""} />
                </Field>
                <Field label="Liberar a partir de" htmlFor="unlockAt" optional hint="Bloqueio real: invisível antes da data.">
                  <Input id="unlockAt" name="unlockAt" type="date" defaultValue={memory.unlock_at?.slice(0, 10) ?? ""} />
                </Field>
                <Field label="Visibilidade" htmlFor="visibility">
                  <Select id="visibility" name="visibility" defaultValue={memory.visibility}>
                    {["family", "private", "selected", "capsule"].map((v) => (
                      <option key={v} value={v}>
                        {VISIBILITY_LABELS[v]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Ordem manual" htmlFor="timelinePosition" optional hint="Desempate no mesmo dia.">
                  <Input id="timelinePosition" name="timelinePosition" type="number" defaultValue={memory.timeline_position ?? ""} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-[15px]">
                <input type="checkbox" name="highlight" defaultChecked={memory.is_highlight} className="size-5 accent-[var(--rose-deep)]" />
                Marcar como destaque (escolha editorial)
              </label>
              <SubmitButton variant="secondary">Salvar</SubmitButton>
            </form>
          </Card>
          {comments.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 text-2xl">Comentários</h2>
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-xl border border-line p-3">
                    <p className="text-sm text-taupe">
                      {c.author?.display_name} · {formatDateTime(c.created_at)} · {c.status}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                    <form action={moderateComment} className="mt-2 flex gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      {c.status !== "approved" && <Button size="sm" name="action" value="approve">Aprovar</Button>}
                      <Button size="sm" variant="secondary" name="action" value="hide">Ocultar</Button>
                      <Button size="sm" variant="danger" name="action" value="remove">Remover</Button>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-3 text-2xl">Moderação</h2>
            <form action={moderateMemory} className="space-y-3">
              <input type="hidden" name="id" value={memory.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Input name="note" placeholder="Recado ao autor (opcional)" />
              <div className="flex flex-wrap gap-2">
                {memory.moderation_status !== "approved" && <Button size="sm" name="action" value="approve">Aprovar</Button>}
                {memory.moderation_status === "hidden" && <Button size="sm" name="action" value="restore">Reexibir</Button>}
                <Button size="sm" variant="secondary" name="action" value="request_changes">Pedir ajuste</Button>
                {memory.moderation_status !== "hidden" && <Button size="sm" variant="secondary" name="action" value="hide">Ocultar</Button>}
                <Button size="sm" variant="secondary" name="action" value="reject">Rejeitar</Button>
                <Button size="sm" variant="danger" name="action" value="remove">Excluir</Button>
              </div>
            </form>
          </Card>
          <Card className="p-5">
            <h2 className="mb-1 text-2xl">Cápsulas</h2>
            <p className="mb-3 text-sm text-taupe">Uma memória pode estar na linha do tempo e em várias cápsulas, sem duplicar arquivos.</p>
            <form action={setMemoryCapsules} className="space-y-2">
              <input type="hidden" name="id" value={memory.id} />
              {(capsules ?? []).map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-[15px]">
                  <input type="checkbox" name="capsules" value={c.id} defaultChecked={inCapsules.has(c.id)} className="size-4 accent-[var(--rose-deep)]" />
                  {c.title}
                </label>
              ))}
              <SubmitButton size="sm" variant="secondary">Atualizar cápsulas</SubmitButton>
            </form>
          </Card>
          <Card className="p-5">
            <h2 className="mb-1 text-2xl">Acesso específico</h2>
            <p className="mb-3 text-sm text-taupe">Para “Participantes selecionados” ou exceções em memórias privadas.</p>
            <ul className="mb-3 space-y-1 text-[15px]">
              {(grants ?? []).map((g) => (
                <li key={g.id} className="flex items-center justify-between">
                  {nameByProfile.get(g.grantee_profile_id) ?? "—"}
                  <form action={revokeAccess}>
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <Button size="sm" variant="ghost">Revogar</Button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={grantAccess} className="flex gap-2">
              <input type="hidden" name="resourceType" value="memory" />
              <input type="hidden" name="resourceId" value={memory.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Select name="personId" className="h-10" aria-label="Pessoa">
                {(people ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
              </Select>
              <Button size="sm" type="submit">Liberar</Button>
            </form>
          </Card>
        </aside>
      </div>
    </>
  );
}
