import type { Metadata } from "next";
import { requireContributor } from "@/lib/permissions/viewer";
import { PageHeader } from "@/components/ui/misc";
import { MemoryComposer } from "@/components/uploads/memory-composer";
import { getComposerData } from "@/features/memories/composer-data";

export const metadata: Metadata = { title: "Registrar minha visita" };

export default async function Page() {
  await requireContributor();
  const data = await getComposerData();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Visita" title="Registrar minha visita" description="Conte que você esteve com a Maya. Acessar este site não registra visita — só este formulário." />
      <MemoryComposer kind="visit" {...data} />
    </div>
  );
}
