import { requireAdmin } from "@/lib/permissions/viewer";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CapsuleCard } from "@/components/capsules/capsule-card";
import { Alert, EmptyState, PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { generateGrowthCapsules } from "@/features/admin/actions";

export const metadata: Metadata = { title: "Cápsulas" };

export default async function AdminCapsulesPage({ searchParams }: { searchParams: Promise<{ geradas?: string; erro?: string }> }) {
  const V = (await requireAdmin()).vault.id;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("capsules")
    .select("id, title, description, theme, capsule_type, opens_at, opening_rule, status, opened_at, capsule_items(count)").eq("vault_id", V)
    .order("opens_at", { ascending: true, nullsFirst: true });
  const capsules = (data ?? []) as unknown as Array<
    Parameters<typeof CapsuleCard>[0]["capsule"] & { capsule_items: Array<{ count: number }> }
  >;
  return (
    <>
      <PageHeader
        eyebrow="Para o futuro"
        title="Cápsulas do tempo"
        description="A abertura é verificada no banco a cada acesso — nenhuma automação abre uma cápsula sozinha."
        actions={
          <>
            <form action={generateGrowthCapsules}>
              <SubmitButton variant="secondary">Gerar marcos de crescimento</SubmitButton>
            </form>
            <ButtonLink href="/admin/capsulas/nova">Nova cápsula</ButtonLink>
          </>
        }
      />
      {sp.geradas && <div className="mb-4"><Alert tone="success">{sp.geradas} cápsula(s) de crescimento criadas como rascunho.</Alert></div>}
      {sp.erro && <div className="mb-4"><Alert tone="error">{sp.erro}</Alert></div>}
      {capsules.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {capsules.map((c) => (
            <CapsuleCard key={c.id} capsule={c} href={`/admin/capsulas/${c.id}`} count={c.capsule_items?.[0]?.count ?? 0} />
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhuma cápsula" action={<ButtonLink href="/admin/capsulas/nova">Criar a primeira</ButtonLink>} />
      )}
    </>
  );
}
