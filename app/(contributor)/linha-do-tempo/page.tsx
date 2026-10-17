import type { Metadata } from "next";
import { subjectWords } from "@/lib/subject";
import { requireMember } from "@/lib/permissions/viewer";
import { listTimeline, type TimelineFilters } from "@/features/memories/queries";
import { Timeline } from "@/components/timeline/timeline";
import { TimelineFiltersForm } from "@/components/timeline/filters";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Linha do tempo" };

export default async function TimelinePage({ searchParams }: { searchParams: Promise<TimelineFilters> }) {
  const viewer = await requireMember();
  const filters = await searchParams;
  const memories = await listTimeline(viewer.vault.id, filters);
  return (
    <>
      <PageHeader eyebrow={`A história ${subjectWords(viewer.vault).of}`} title="Linha do tempo" description="Memórias aprovadas que você pode ver, na ordem em que aconteceram." />
      <TimelineFiltersForm filters={filters} basePath="/linha-do-tempo" />
      {memories.length ? (
        <Timeline memories={memories} hrefFor={(m) => `/memoria/${m.id}`} />
      ) : (
        <EmptyState
          title="A história está começando"
          action={viewer.canContribute ? <ButtonLink href="/enviar/foto">Enviar a primeira memória</ButtonLink> : undefined}
        >
          Assim que {subjectWords(viewer.vault).keepers} aprovarem as primeiras memórias, elas aparecerão aqui.
        </EmptyState>
      )}
    </>
  );
}
