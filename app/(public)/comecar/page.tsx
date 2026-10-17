import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { HeartDoodle } from "@/components/ui/doodles";
import { SignupForm } from "@/components/signup/signup-form";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/permissions/viewer";
import { isSupabaseConfigured } from "@/lib/env";
import { getPublicPlans } from "@/features/plans/queries";

export const metadata: Metadata = {
  title: "Criar meu baú",
  description: "Crie grátis o baú de memórias da sua família em um minuto.",
  robots: { index: true, follow: true },
};

const FALLBACK_RELATIONSHIPS = [
  { key: "mae", label: "Mãe" }, { key: "pai", label: "Pai" }, { key: "avo", label: "Avós" }, { key: "tio", label: "Tios" },
  { key: "padrinho", label: "Padrinhos" }, { key: "amigo_familia", label: "Amigos da família" }, { key: "outro", label: "Outros" },
];

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ tipo?: string; plano?: string }> }) {
  const { tipo, plano } = await searchParams;
  const plan = plano ? (await getPublicPlans()).find((p) => p.key === plano && p.billing !== "free") : undefined;
  let relationships = FALLBACK_RELATIONSHIPS;
  if (isSupabaseConfigured()) {
    const viewer = await getViewer();
    // Já tem conta e está logado: cria o baú pela área dele
    if (viewer) redirect("/baus");
    const supabase = await createClient();
    const { data } = await supabase.from("relationship_types").select("key, label").eq("active", true).neq("key", "convidado").order("sort_order");
    if (data?.length) relationships = data.filter((r) => r.key !== "maya");
  }
  return (
    <div className="mx-auto max-w-xl pt-2">
      <div className="text-center">
        <HeartDoodle className="mx-auto size-12 text-rose-deep" />
        <h1 className="mt-2 text-6xl">Vamos criar o seu baú</h1>
        <p className="mt-2 text-[15px] text-taupe">Grátis, em um minuto. Sem cartão. Você já sai guardando a primeira memória.</p>
      </div>
      <Card className="mt-8 p-6 sm:p-8">
        <SignupForm relationshipTypes={relationships} defaultKind={tipo === "evento" ? "event" : "child"} plan={plan ? { key: plan.key, name: plan.name } : null} />
      </Card>
      <p className="mt-6 text-center text-sm text-taupe">
        Já tem conta? <Link href="/entrar" className="font-semibold text-rose-deep underline-offset-4 hover:underline">Entrar</Link>
      </p>
    </div>
  );
}
