import type { Metadata } from "next";
import { requireContributor } from "@/lib/permissions/viewer";
import { PageHeader } from "@/components/ui/misc";
import { MemoryComposer } from "@/components/uploads/memory-composer";
import { getComposerData } from "@/features/memories/composer-data";

export const metadata: Metadata = { title: "Deixe uma mensagem para a Maya" };

export default async function Page() {
  await requireContributor();
  const data = await getComposerData();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Mensagem de voz" title="Deixe uma mensagem para a Maya" description="Conte uma lembrança que gostaria que ela guardasse." />
      <MemoryComposer kind="audio" {...data} />
    </div>
  );
}
