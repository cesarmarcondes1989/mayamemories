import type { Metadata } from "next";
import { requireMember } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { CapsuleCard } from "@/components/capsules/capsule-card";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Cápsulas" };

export default async function CapsulesPage() {
  await requireMember();
  const supabase = await createClient();
  const { data } = await supabase
    .from("capsules")
    .select("id, title, description, theme, capsule_type, opens_at, opening_rule, status, opened_at")
    .neq("status", "draft")
    .order("opens_at", { ascending: true, nullsFirst: true });
  const capsules = data ?? [];
  return (
    <>
      <PageHeader
        eyebrow="Guardadas para o futuro"
        title="Cápsulas do tempo"
        description="Coleções de memórias que serão revisitadas em momentos especiais. O conteúdo só aparece quando cada cápsula for aberta."
      />
      {capsules.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {capsules.map((c) => (
            <CapsuleCard key={c.id} capsule={c} href={`/capsulas/${c.id}`} />
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhuma cápsula por enquanto">Os pais da Maya ainda estão preparando as cápsulas.</EmptyState>
      )}
    </>
  );
}
