import type { Metadata } from "next";
import { subjectWords } from "@/lib/subject";
import { requireMember } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { MEMORY_TYPE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Memória recebida" };

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ m?: string; tipo?: string }> }) {
  const viewer = await requireMember();
  const { m } = await searchParams;
  const supabase = await createClient();
  const { data: memory } = m
    ? await supabase.from("memories").select("id, memory_type, moderation_status, submitted_at, created_at").eq("id", m).maybeSingle()
    : { data: null };

  return (
    <div className="mx-auto max-w-lg pt-6 text-center">
      <div aria-hidden="true" className="mx-auto mb-6 grid size-16 place-items-center rounded-full bg-rose-soft text-3xl text-rose-deep">
        ♡
      </div>
      <h1 className="text-5xl">Memória recebida com carinho.</h1>
      <p className="mt-4 text-taupe">Ela ficará guardada com cuidado enquanto {subjectWords(viewer.vault).keepers} revisam sua publicação.</p>
      {memory && (
        <Card className="mt-8 p-5 text-left">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
            <dt className="text-taupe">Tipo</dt>
            <dd>{MEMORY_TYPE_LABELS[memory.memory_type] ?? memory.memory_type}</dd>
            <dt className="text-taupe">Enviada em</dt>
            <dd>{formatDateTime(memory.submitted_at ?? memory.created_at)}</dd>
            <dt className="text-taupe">Status</dt>
            <dd>
              <StatusBadge status={memory.moderation_status} />
            </dd>
          </dl>
        </Card>
      )}
      <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
        <ButtonLink href="/inicio" variant="secondary">
          Voltar ao início
        </ButtonLink>
        <ButtonLink href="/enviar/foto">Enviar outra memória</ButtonLink>
      </div>
    </div>
  );
}
