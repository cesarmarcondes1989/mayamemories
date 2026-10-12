import type { Metadata } from "next";
import { requireContributor } from "@/lib/permissions/viewer";
import { PageHeader } from "@/components/ui/misc";
import { MemoryComposer } from "@/components/uploads/memory-composer";
import { getComposerData } from "@/features/memories/composer-data";

export const metadata: Metadata = { title: "Enviar um desenho ou documento" };

export default async function Page() {
  await requireContributor();
  const data = await getComposerData();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Documento" title="Enviar um desenho ou documento" description="Desenhos, cartões, papéis digitalizados." />
      <MemoryComposer kind="drawing" {...data} />
    </div>
  );
}
