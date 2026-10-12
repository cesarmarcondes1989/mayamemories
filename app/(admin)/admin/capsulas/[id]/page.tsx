import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addCapsuleItems, grantAccess, removeCapsuleItem, revokeAccess, setCapsuleStatus, updateCapsule } from "@/features/admin/actions";
import { CapsuleForm } from "@/components/admin/capsule-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ConfirmAction } from "@/components/ui/confirm-form";
import { CAPSULE_STATE_LABELS, capsuleDisplayState } from "@/lib/permissions/capsules";
import { MEMORY_TYPE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Cápsula" };

export default async function AdminCapsulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string; erro?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: capsule } = await supabase.from("capsules").select("*").eq("id", id).maybeSingle();
  if (!capsule) notFound();
  const [{ data: items }, { data: candidates }, { data: grants }, { data: people }, { data: history }] = await Promise.all([
    supabase
      .from("capsule_items")
      .select("memory_id, position, memory:memories(id, title, memory_type, occurred_at, moderation_status)")
      .eq("capsule_id", id)
      .order("position"),
    supabase
      .from("memories")
      .select("id, title, memory_type, occurred_at, author:people!memories_author_person_id_fkey(display_name)")
      .eq("moderation_status", "approved")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase.from("access_grants").select("id, grantee_profile_id").eq("resource_type", "capsule").eq("resource_id", id).is("revoked_at", null),
    supabase.from("people").select("id, display_name, profile_id").not("profile_id", "is", null).order("display_name"),
    supabase.from("audit_events").select("action, created_at, metadata").eq("resource_type", "capsules").eq("resource_id", id).order("created_at", { ascending: false }).limit(15),
  ]);
  const state = capsuleDisplayState(capsule);
  const already = new Set((items ?? []).map((i) => i.memory_id));
  const nameByProfile = new Map((people ?? []).map((p) => [p.profile_id, p.display_name]));
  const returnTo = `/admin/capsulas/${id}`;
  type Item = { memory_id: string; memory: { id: string; title: string | null; memory_type: string; occurred_at: string | null; moderation_status: string } | null };
  type Candidate = { id: string; title: string | null; memory_type: string; occurred_at: string | null; author: { display_name: string } | null };

  return (
    <>
      <PageHeader
        eyebrow={CAPSULE_STATE_LABELS[state]}
        title={capsule.title}
        description={capsule.opens_at ? `Data de abertura: ${formatDate(capsule.opens_at)}` : "Abertura manual"}
        actions={<Link href={`/capsulas/${id}`} className="text-sm text-rose-deep hover:underline">Ver prévia como família →</Link>}
      />
      {sp.salvo && <div className="mb-4"><Alert tone="success">Salvo.</Alert></div>}
      {sp.erro && <div className="mb-4"><Alert tone="error">{sp.erro}</Alert></div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-2xl">Memórias na cápsula ({items?.length ?? 0})</h2>
            {(items ?? []).length === 0 && <p className="text-taupe">Nenhuma memória ainda.</p>}
            <ul className="divide-y divide-line">
              {((items ?? []) as unknown as Item[]).map((i) => (
                <li key={i.memory_id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/admin/memorias/${i.memory_id}`} className="min-w-0 truncate hover:underline">
                    {i.memory?.title ?? "Sem título"}{" "}
                    <span className="text-sm text-taupe">· {MEMORY_TYPE_LABELS[i.memory?.memory_type ?? ""]} · {formatDate(i.memory?.occurred_at)}</span>
                  </Link>
                  <form action={removeCapsuleItem}>
                    <input type="hidden" name="capsuleId" value={id} />
                    <input type="hidden" name="memoryId" value={i.memory_id} />
                    <Button size="sm" variant="ghost">Remover</Button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 text-2xl">Adicionar memórias aprovadas</h2>
            <form action={addCapsuleItems}>
              <input type="hidden" name="capsuleId" value={id} />
              <ul className="max-h-96 space-y-1 overflow-y-auto pr-2">
                {((candidates ?? []) as unknown as Candidate[])
                  .filter((c) => !already.has(c.id))
                  .map((c) => (
                    <li key={c.id}>
                      <label className="flex items-center gap-2 rounded-lg px-2 py-1 text-[15px] hover:bg-cream">
                        <input type="checkbox" name="memoryIds" value={c.id} className="size-4 accent-[var(--rose-deep)]" />
                        <span className="truncate">
                          {c.title ?? MEMORY_TYPE_LABELS[c.memory_type]} <span className="text-sm text-taupe">· {c.author?.display_name} · {formatDate(c.occurred_at)}</span>
                        </span>
                      </label>
                    </li>
                  ))}
              </ul>
              <Button size="sm" className="mt-3" type="submit">Adicionar selecionadas</Button>
            </form>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 text-2xl">Editar</h2>
            <CapsuleForm action={updateCapsule} capsule={capsule} submitLabel="Salvar" />
          </Card>
        </div>
        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-2 text-2xl">Estado</h2>
            <Badge tone={state === "open" ? "ok" : "rose"}>{CAPSULE_STATE_LABELS[state]}</Badge>
            {capsule.opened_at && <p className="mt-2 text-sm text-taupe">Aberta em {formatDateTime(capsule.opened_at)}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {capsule.status === "draft" && (
                <form action={setCapsuleStatus}>
                  <input type="hidden" name="id" value={id} />
                  <Button size="sm" name="status" value="scheduled">Programar (mostrar à família)</Button>
                </form>
              )}
              {["scheduled", "sealed"].includes(capsule.status) && capsule.opening_rule !== "date" && (
                <ConfirmAction
                  action={setCapsuleStatus}
                  hidden={{ id, status: "open" }}
                  variant="primary"
                  label="Abrir cápsula"
                  title="Abrir esta cápsula agora?"
                  description="A família autorizada passará a ver todo o conteúdo. A abertura fica registrada na auditoria."
                  confirmLabel="Abrir"
                />
              )}
              {capsule.status !== "sealed" && capsule.status !== "draft" && (
                <form action={setCapsuleStatus}>
                  <input type="hidden" name="id" value={id} />
                  <Button size="sm" variant="secondary" name="status" value="sealed">Fechar temporariamente</Button>
                </form>
              )}
              {capsule.status === "sealed" && (
                <form action={setCapsuleStatus}>
                  <input type="hidden" name="id" value={id} />
                  <Button size="sm" variant="secondary" name="status" value="scheduled">Reprogramar</Button>
                </form>
              )}
              {capsule.status !== "archived" && (
                <form action={setCapsuleStatus}>
                  <input type="hidden" name="id" value={id} />
                  <Button size="sm" variant="ghost" name="status" value="archived">Arquivar</Button>
                </form>
              )}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="mb-1 text-2xl">Colaboradores com acesso</h2>
            <p className="mb-3 text-sm text-taupe">Para cápsulas de “Participantes selecionados”.</p>
            <ul className="mb-3 space-y-1">
              {(grants ?? []).map((g) => (
                <li key={g.id} className="flex items-center justify-between text-[15px]">
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
              <input type="hidden" name="resourceType" value="capsule" />
              <input type="hidden" name="resourceId" value={id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Select name="personId" className="h-10" aria-label="Pessoa">
                {(people ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </Select>
              <Button size="sm" type="submit">Liberar</Button>
            </form>
          </Card>
          <Card className="p-5">
            <h2 className="mb-2 text-2xl">Histórico</h2>
            <ul className="space-y-1 text-sm">
              {(history ?? []).map((h, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{h.action}</span>
                  <span className="text-taupe">{formatDateTime(h.created_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
