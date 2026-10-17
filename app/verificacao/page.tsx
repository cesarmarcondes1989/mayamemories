import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/misc";
import { MfaGate } from "@/components/auth/mfa-gate";

export const metadata: Metadata = { title: "Verificação em 2 etapas" };
export const dynamic = "force-dynamic";

export default async function MfaPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar?next=/plataforma");
  if (!viewer.isPlatformAdmin) redirect("/inicio");
  const supabase = await createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") redirect("/plataforma");
  return (
    <div className="paper-grain grid min-h-dvh place-items-center px-4 py-10">
      <Card className="w-full max-w-sm p-6">
        <Logo className="mx-auto size-12" />
        <h1 className="mt-2 text-center text-4xl">Área do dono</h1>
        <p className="mb-6 text-center text-sm text-taupe">
          Aqui ficam interessados, preços e analytics de todo o site. Por isso pedimos um segundo fator, sempre.
        </p>
        <MfaGate />
      </Card>
    </div>
  );
}
