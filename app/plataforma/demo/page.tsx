import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDemo } from "@/features/demo/actions";
import { Card } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClasses } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Demonstração" };
export const maxDuration = 60;

export default async function DemoAdminPage({ searchParams }: { searchParams: Promise<{ criado?: string; erro?: string }> }) {
  const sp = await searchParams;
  const admin = createAdminClient();
  const { data: vault } = await admin.from("vaults").select("id, title, created_at").eq("is_demo", true).maybeSingle();
  const counts = vault
    ? await Promise.all(
        ["memories", "people", "capsules", "vault_events"].map((t) =>
          admin.from(t).select("id", { count: "exact", head: true }).eq("vault_id", vault.id).then((r) => r.count ?? 0),
        ),
      )
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Vitrine"
        title="Demonstração"
        description="O Baú da Alice: uma família fictícia que qualquer pessoa pode visitar em /demo, como família ou como administradora. Ninguém consegue alterar nada — o banco recusa."
      />
      {sp.criado && <Alert tone="success">Demo pronta com {sp.criado} memórias. Abra /demo para ver.</Alert>}
      {sp.erro && <Alert tone="error">Não deu certo: {sp.erro}</Alert>}
      <Card className="p-6">
        {vault ? (
          <>
            <h2 className="text-3xl">{vault.title}</h2>
            <p className="text-sm text-taupe">Criada em {formatDateTime(vault.created_at)}</p>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              {["memórias", "pessoas", "cápsulas", "eventos"].map((label, i) => (
                <div key={label} className="rounded-2xl bg-cream px-2 py-3">
                  <p className="text-2xl font-bold">{counts?.[i]}</p>
                  <p className="text-xs text-taupe">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/demo" className={buttonClasses("secondary", "sm")}>Abrir /demo</Link>
            </div>
          </>
        ) : (
          <p className="text-[15px]">Ainda não existe demonstração. Crie com um clique (leva uns 20 segundos).</p>
        )}
        <form action={createDemo} className="mt-6 border-t border-line pt-4">
          <SubmitButton pendingText="Montando o Baú da Alice…">{vault ? "Recriar a demonstração do zero" : "Criar a demonstração"}</SubmitButton>
          <p className="mt-2 text-xs text-taupe">Recriar arquiva a demo atual e monta outra limpa, com as mesmas memórias.</p>
        </form>
      </Card>
    </div>
  );
}
