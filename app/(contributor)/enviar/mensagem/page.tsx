import type { Metadata } from "next";
import { subjectWords } from "@/lib/subject";
import { requireContributor } from "@/lib/permissions/viewer";
import { PageHeader } from "@/components/ui/misc";
import { MemoryComposer } from "@/components/uploads/memory-composer";
import { getComposerData } from "@/features/memories/composer-data";

export const metadata: Metadata = { title: "Escrever uma mensagem" };

export default async function Page() {
  const viewer = await requireContributor();
  const sw = subjectWords(viewer.vault);
  const data = await getComposerData();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Mensagem" title="Escrever uma mensagem" description={`Uma lembrança, um desejo, uma história ${sw.of}.`} />
      <MemoryComposer subject={sw} kind="text" {...data} />
    </div>
  );
}
