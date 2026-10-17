import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { CreateVaultForm } from "@/components/vaults/create-vault-form";

export const metadata: Metadata = { title: "Meus baús" };

export default async function VaultsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar?next=/baus");
  const supabase = await createClient();
  const [{ data: rel }, { data: settings }] = await Promise.all([
    supabase.from("relationship_types").select("key, label").eq("active", true).order("sort_order"),
    supabase.from("app_settings").select("self_service_vaults").maybeSingle(),
  ]);
  const canCreate = viewer.isPlatformAdmin || Boolean(settings?.self_service_vaults);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow="Seus baús" title="Meus baús" description="Cada baú é um espaço separado, com as suas pessoas, memórias e cápsulas." />
      {viewer.vaults.length === 0 ? (
        <EmptyState title="Você ainda não participa de nenhum baú">Peça um convite a quem cuida do baú.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {viewer.vaults.map((v) => {
            const current = v.vault_id === viewer.vault?.id;
            return (
              <li key={v.vault_id} data-theme={v.theme}>
                <Card className={`p-5 ${current ? "ring-2 ring-rose-deep" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-taupe uppercase">{v.kind === "event" ? "Evento" : "Criança"}</p>
                      <h2 className="text-3xl">{v.title}</h2>
                    </div>
                    <span aria-hidden="true" className="mt-1 size-6 rounded-full bg-rose-deep" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.roles.includes("admin") && <Badge tone="rose">Administra</Badge>}
                    {v.status === "read_only" && <Badge tone="warn">Só leitura</Badge>}
                    {current && <Badge tone="ok">Em uso</Badge>}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/baus/${v.vault_id}`} className="inline-flex h-10 items-center rounded-full bg-rose-deep px-4 text-sm font-semibold text-white">
                      Abrir
                    </Link>
                    {v.roles.includes("admin") && (
                      <Link href={`/baus/${v.vault_id}?para=admin`} className="inline-flex h-10 items-center rounded-full border border-rose/70 bg-paper px-4 text-sm font-semibold text-rose-deep">
                        Administrar
                      </Link>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {canCreate && (
        <Card className="p-6">
          <h2 className="mb-1 text-3xl">Criar um baú novo</h2>
          <p className="mb-5 text-sm text-taupe">Você será o administrador. Já vem com o grupo da família e cápsulas sugeridas.</p>
          <CreateVaultForm relationshipTypes={rel ?? []} />
        </Card>
      )}
    </div>
  );
}
