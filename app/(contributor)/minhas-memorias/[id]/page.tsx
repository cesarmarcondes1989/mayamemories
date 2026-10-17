import type { Metadata } from "next";
import { subjectWords } from "@/lib/subject";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/permissions/viewer";
import { getMemory } from "@/features/memories/queries";
import { requestRemoval, updateOwnMemory } from "@/features/memories/actions";
import { MediaView } from "@/components/memories/media-view";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmAction } from "@/components/ui/confirm-form";
import { Alert } from "@/components/ui/misc";
import { PrivacyBadge, StatusBadge } from "@/components/ui/badge";
import { MEMORY_TYPE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Minha memória" };

export default async function MyMemoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; salvo?: string; pedido?: string }>;
}) {
  const viewer = await requireMember();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const memory = await getMemory(id);
  if (!memory || memory.created_by_profile_id !== viewer.profileId) notFound();
  const editable = ["draft", "pending_review", "changes_requested", "approved", "rejected"].includes(memory.moderation_status);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-taupe">{MEMORY_TYPE_LABELS[memory.memory_type]}</p>
        <h1 className="text-4xl">{memory.title ?? "Sem título"}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge status={memory.moderation_status} />
          <PrivacyBadge visibility={memory.visibility} />
        </div>
        <p className="mt-2 text-sm text-taupe">
          Enviada em {formatDateTime(memory.submitted_at ?? memory.created_at)}
          {memory.unlock_at && ` · abre em ${formatDate(memory.unlock_at)}`}
        </p>
      </div>
      {sp.salvo && <Alert tone="success">Alterações salvas. {memory.moderation_status === "pending_review" && "Elas passarão por uma nova revisão."}</Alert>}
      {sp.pedido && <Alert tone="success">Pedido de exclusão enviado a {subjectWords(viewer.vault).keepers}.</Alert>}
      {sp.erro && <Alert tone="error">{sp.erro}</Alert>}
      {memory.moderation_note && ["changes_requested", "rejected"].includes(memory.moderation_status) && (
        <Alert tone="warn" title="Recado de quem cuida do baú">
          {memory.moderation_note}
        </Alert>
      )}
      {memory.media_assets.map((a) => (
        <MediaView key={a.id} asset={a} />
      ))}
      {editable ? (
        <Card className="p-5">
          <form action={updateOwnMemory} className="space-y-4">
            <input type="hidden" name="memoryId" value={memory.id} />
            <Field label="Título" htmlFor="title" optional>
              <Input id="title" name="title" defaultValue={memory.title ?? ""} maxLength={200} />
            </Field>
            <Field label="Texto" htmlFor="description" optional>
              <Textarea id="description" name="description" defaultValue={memory.description ?? ""} maxLength={20000} />
            </Field>
            <Field label="Data do acontecimento" htmlFor="occurredAt" optional>
              <Input id="occurredAt" name="occurredAt" type="date" defaultValue={memory.occurred_at ?? ""} />
            </Field>
            {memory.moderation_status === "approved" && (
              <p className="text-sm text-taupe">Ao salvar, a memória volta para revisão antes de reaparecer.</p>
            )}
            <SubmitButton variant="secondary">Salvar alterações</SubmitButton>
          </form>
        </Card>
      ) : (
        memory.description && <p className="whitespace-pre-wrap">{memory.description}</p>
      )}
      <div className="flex justify-end">
        <ConfirmAction
          action={requestRemoval}
          hidden={{ memoryId: memory.id }}
          label={memory.moderation_status === "approved" ? "Pedir exclusão" : "Retirar memória"}
          title={memory.moderation_status === "approved" ? "Pedir a exclusão desta memória?" : "Retirar esta memória?"}
          description={
            memory.moderation_status === "approved"
              ? "Quem cuida do baú receberá o seu pedido e fará a exclusão dos arquivos."
              : "Ela ainda não foi publicada e será removida com os arquivos."
          }
          confirmLabel="Confirmar"
        />
      </div>
    </div>
  );
}
