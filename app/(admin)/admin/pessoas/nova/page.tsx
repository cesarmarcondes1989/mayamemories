import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createPerson } from "@/features/admin/actions";
import { PersonForm } from "@/components/admin/person-form";
import { Card } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Nova pessoa" };

export default async function NewPersonPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("relationship_types").select("key, label").eq("active", true).order("sort_order");
  return (
    <div className="max-w-xl">
      <PageHeader title="Adicionar pessoa" description="A pessoa existe aqui antes mesmo de ativar a conta. Depois, envie um convite." />
      {erro && <div className="mb-4"><Alert tone="error">{erro}</Alert></div>}
      <Card className="p-6">
        <PersonForm action={createPerson} relationshipTypes={data ?? []} submitLabel="Adicionar" />
      </Card>
    </div>
  );
}
