import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { listTimeline } from "@/features/memories/queries";
import { Timeline } from "@/components/timeline/timeline";
import { EmptyState } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { capsuleDisplayState, CAPSULE_STATE_LABELS } from "@/lib/permissions/capsules";

export const metadata: Metadata = { title: "Cápsula" };

export default async function CapsulePage({ params }: { params: Promise<{ id: string }> }) {
  await requireMember();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: capsule }, { data: isOpen }] = await Promise.all([
    supabase.from("capsules").select("*").eq("id", id).maybeSingle(),
    supabase.rpc("capsule_viewable", { p_capsule_id: id }),
  ]);
  if (!capsule) notFound();
  const memories = isOpen ? await listTimeline({ capsule: id }) : [];
  const state = capsuleDisplayState(capsule);

  return (
    <div>
      <header className="mb-10 text-center">
        <p className="text-xs font-medium tracking-[0.2em] text-rose-deep uppercase">{CAPSULE_STATE_LABELS[state]}</p>
        <h1 className="mt-2 text-5xl">{capsule.title}</h1>
        {capsule.description && <p className="mx-auto mt-3 max-w-xl text-taupe">{capsule.description}</p>}
        {capsule.theme && <p className="mt-2 font-hand text-2xl text-rose-deep">“{capsule.theme}”</p>}
      </header>
      {isOpen ? (
        memories.length ? (
          <Timeline memories={memories} hrefFor={(m) => `/memoria/${m.id}`} />
        ) : (
          <EmptyState title="Cápsula aberta">Ainda não há memórias nesta cápsula.</EmptyState>
        )
      ) : (
        <div className="mx-auto max-w-md rounded-[var(--radius-card)] border border-line bg-paper p-8 text-center">
          <p aria-hidden="true" className="text-5xl">
            ⧗
          </p>
          <p className="mt-4 text-lg">Esta cápsula está guardada.</p>
          <p className="mt-2 text-taupe">
            {capsule.opens_at ? `Ela poderá ser aberta a partir de ${formatDate(capsule.opens_at)}.` : "Os pais da Maya decidirão o momento certo de abri-la."}
          </p>
        </div>
      )}
    </div>
  );
}
