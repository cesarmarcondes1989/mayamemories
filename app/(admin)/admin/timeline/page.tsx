import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listTimeline, type TimelineFilters } from "@/features/memories/queries";
import { Timeline } from "@/components/timeline/timeline";
import { TimelineFiltersForm } from "@/components/timeline/filters";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Linha do tempo" };

export default async function AdminTimelinePage({ searchParams }: { searchParams: Promise<TimelineFilters> }) {
  const filters = await searchParams;
  const supabase = await createClient();
  const [memories, { data: people }, { data: capsules }] = await Promise.all([
    listTimeline(filters, { includeCapsuleOnly: true }),
    supabase.from("people").select("id, display_name").order("display_name"),
    supabase.from("capsules").select("id, title").order("title"),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Linha do tempo"
        description="Visão completa (inclui memórias guardadas só em cápsulas). Clique em uma memória para corrigir data, ordem ou destaque."
      />
      <TimelineFiltersForm filters={filters} basePath="/admin/timeline" people={people ?? []} capsules={capsules ?? []} />
      {memories.length ? (
        <Timeline memories={memories} hrefFor={(m) => `/admin/memorias/${m.id}`} />
      ) : (
        <EmptyState title="Nenhuma memória aprovada ainda" />
      )}
    </>
  );
}
