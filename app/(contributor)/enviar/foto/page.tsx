import type { Metadata } from "next";
import { subjectWords } from "@/lib/subject";
import { requireContributor } from "@/lib/permissions/viewer";
import { PageHeader } from "@/components/ui/misc";
import { MemoryComposer } from "@/components/uploads/memory-composer";
import { getComposerData } from "@/features/memories/composer-data";

export const metadata: Metadata = { title: "Enviar uma foto ou vídeo" };

export default async function Page() {
  const viewer = await requireContributor();
  const sw = subjectWords(viewer.vault);
  const data = await getComposerData();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Nova memória" title="Enviar uma foto ou vídeo" description="Escolha do celular ou tire na hora. Você pode corrigir a data do momento." />
      <MemoryComposer subject={sw} kind="photo" {...data} />
    </div>
  );
}
