import type { Metadata } from "next";
import { subjectWords } from "@/lib/subject";
import { requireContributor } from "@/lib/permissions/viewer";
import { PageHeader } from "@/components/ui/misc";
import { MemoryComposer } from "@/components/uploads/memory-composer";
import { getComposerData } from "@/features/memories/composer-data";

export const metadata: Metadata = { title: "Mensagem de voz" };

export default async function Page() {
  const viewer = await requireContributor();
  const sw = subjectWords(viewer.vault);
  const data = await getComposerData();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Mensagem de voz" title={`Deixe uma mensagem ${sw.to}`} description="Conte uma lembrança que gostaria que ela guardasse." />
      <MemoryComposer subject={sw} kind="audio" {...data} />
    </div>
  );
}
