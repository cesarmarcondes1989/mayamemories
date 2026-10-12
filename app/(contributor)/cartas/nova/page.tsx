import type { Metadata } from "next";
import { requireContributor } from "@/lib/permissions/viewer";
import { PageHeader } from "@/components/ui/misc";
import { MemoryComposer } from "@/components/uploads/memory-composer";
import { getComposerData } from "@/features/memories/composer-data";

export const metadata: Metadata = { title: "Uma carta para o futuro" };

export default async function Page() {
  await requireContributor();
  const data = await getComposerData();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Carta" title="Uma carta para o futuro" description="Ela ficará guardada e só poderá ser lida na data que você escolher." />
      <MemoryComposer kind="letter" {...data} />
    </div>
  );
}
