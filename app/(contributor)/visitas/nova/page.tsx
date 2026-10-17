import type { Metadata } from "next";
import { subjectWords } from "@/lib/subject";
import { requireContributor } from "@/lib/permissions/viewer";
import { PageHeader } from "@/components/ui/misc";
import { MemoryComposer } from "@/components/uploads/memory-composer";
import { getComposerData } from "@/features/memories/composer-data";

export const metadata: Metadata = { title: "Registrar minha visita" };

export default async function Page() {
  const viewer = await requireContributor();
  const sw = subjectWords(viewer.vault);
  const data = await getComposerData();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Visita" title="Registrar minha visita" description={`Conte que você esteve ${sw.with}. Acessar este site não registra visita — só este formulário.`} />
      <MemoryComposer subject={sw} kind="visit" {...data} />
    </div>
  );
}
