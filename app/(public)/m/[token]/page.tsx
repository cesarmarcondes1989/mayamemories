import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/permissions/viewer";
import { Card } from "@/components/ui/card";
import { EmailLinkForm } from "@/components/auth/email-form";
import { requestLoginLink } from "@/features/auth/actions";
import { UnavailableMessage } from "@/components/auth/unavailable";
import { HomeActions, HomeHero } from "@/components/contributor/home-actions";

export const metadata: Metadata = { title: "Maya" };
export const dynamic = "force-dynamic";

/**
 * Entrada pelo coração NFC. A URL é estável; o token apenas identifica a
 * porta de entrada. Abrir esta página NÃO cria visita e NÃO concede acesso.
 */
export default async function NfcEntryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("resolve_nfc_token", { p_public_id: token });
  const resolved = Array.isArray(data) ? data[0] : null;
  if (!resolved || resolved.state !== "active") {
    return <UnavailableMessage reason="Este chaveiro foi desativado ou substituído." />;
  }

  const viewer = await getViewer();
  if (viewer?.personId) {
    if (!viewer.hasConsent && !viewer.isAdmin) redirect("/boas-vindas");
    await supabase.rpc("touch_last_seen");
    return (
      <div className="mx-auto max-w-3xl pt-2">
        <HomeHero name={resolved.greeting_name ?? viewer.displayName.split(" ")[0]} />
        <HomeActions />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md pt-4 text-center">
      <p className="font-display text-7xl text-rose-deep italic">Maya</p>
      <h1 className="mt-4 text-4xl leading-tight">Você faz parte da história dela.</h1>
      <p className="mt-3 text-taupe">
        Um espaço para guardar momentos, palavras e lembranças que ela poderá descobrir ao longo da vida.
      </p>
      <Card className="mt-8 p-6 text-left">
        <p className="mb-4 text-[15px] text-taupe">Para continuar, confirme o seu e-mail. É rápido e não precisa de senha.</p>
        <EmailLinkForm action={requestLoginLink} hidden={{ next: `/m/${token}` }} submitLabel="Continuar" />
      </Card>
    </div>
  );
}
