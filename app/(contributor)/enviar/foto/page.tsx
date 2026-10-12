import type { Metadata } from "next";
import { requireContributor } from "@/lib/permissions/viewer";
import { PageHeader } from "@/components/ui/misc";
import { MemoryComposer } from "@/components/uploads/memory-composer";
import { getComposerData } from "@/features/memories/composer-data";

export const metadata: Metadata = { title: "Enviar uma foto ou vídeo" };

export default async function Page() {
  await requireContributor();
  const data = await getComposerData();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Nova memória" title="Enviar uma foto ou vídeo" description="Escolha do celular ou tire na hora. Você pode corrigir a data do momento." />
      <MemoryComposer kind="photo" {...data} />
    </div>
  );
}
