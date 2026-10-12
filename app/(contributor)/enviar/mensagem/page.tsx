import type { Metadata } from "next";
import { requireContributor } from "@/lib/permissions/viewer";
import { PageHeader } from "@/components/ui/misc";
import { MemoryComposer } from "@/components/uploads/memory-composer";
import { getComposerData } from "@/features/memories/composer-data";

export const metadata: Metadata = { title: "Escrever uma mensagem" };

export default async function Page() {
  await requireContributor();
  const data = await getComposerData();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Mensagem" title="Escrever uma mensagem" description="Uma lembrança, um desejo, uma história sobre a Maya." />
      <MemoryComposer kind="text" {...data} />
    </div>
  );
}
