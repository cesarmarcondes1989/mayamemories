import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { CapsuleForm } from "@/components/admin/capsule-form";
import { createCapsule } from "@/features/admin/actions";

export const metadata: Metadata = { title: "Nova cápsula" };

export default async function NewCapsulePage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <div className="max-w-2xl">
      <PageHeader title="Nova cápsula" description="Ela começa como rascunho — invisível para a família até você programá-la." />
      {erro && <div className="mb-4"><Alert tone="error">{erro}</Alert></div>}
      <Card className="p-6">
        <CapsuleForm action={createCapsule} submitLabel="Criar cápsula" />
      </Card>
    </div>
  );
}
