import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/permissions/viewer";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { EmailLinkForm } from "@/components/auth/email-form";
import { requestLoginLink } from "@/features/auth/actions";
import { UnavailableMessage } from "@/components/auth/unavailable";
import { HomeActions, HomeHero } from "@/components/contributor/home-actions";

export const metadata: Metadata = { title: "Maya" };
export const dynamic = "force-dynamic";

/**
 * Página do ursinho. O token é a identidade de UMA pessoa: quem aproxima o
 * celular entra direto como ela (sem e-mail). Abrir esta página NÃO registra visita.
 */
export default async function NfcEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ falha?: string; admin?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("resolve_nfc_token", { p_public_id: token });
  const resolved = Array.isArray(data) ? data[0] : null;
  if (!resolved || resolved.state !== "active") {
    return <UnavailableMessage reason="Este chaveiro foi desativado ou substituído." />;
  }

  if (resolved.is_my_token) {
    const viewer = await getViewer();
    await supabase.rpc("touch_last_seen");
    return (
      <div className="mx-auto max-w-3xl pt-2">
        <HomeHero name={resolved.greeting_name ?? viewer?.displayName.split(" ")[0]} />
        <HomeActions />
      </div>
    );
  }

  // Ainda não é a pessoa do ursinho neste celular: entra direto como ela.
  if (!sp.falha && !sp.admin) redirect(`/m/${encodeURIComponent(token)}/entrar`);

  // Ursinho de administrador (ou falha de configuração): entra por e-mail.
  const viewer = await getViewer();
  return (
    <div className="mx-auto max-w-md pt-4 text-center">
      <p className="font-display text-8xl">Maya</p>
      <h1 className="mt-2 text-4xl">Você faz parte da história dela</h1>
      <Card className="mt-8 p-6 text-left">
        {sp.admin ? (
          <p className="mb-4 text-[15px] text-taupe">
            Este ursinho é de um <strong className="text-rose-deep">administrador</strong>. Por segurança, ursinhos de
            administradores não abrem sozinhos: entre com o link enviado ao e-mail dessa pessoa.
            {viewer?.displayName && (
              <span className="mt-2 block text-sm">
                Neste celular você está conectado como <strong>{viewer.displayName}</strong>, que não é o dono deste ursinho.
              </span>
            )}
          </p>
        ) : (
          <div className="mb-4">
            <Alert tone="warn">
              {sp.falha === "sem-pessoa"
                ? "Este ursinho ainda não está ligado a uma pessoa. Peça aos pais da Maya para vinculá-lo."
                : "Não conseguimos abrir o acesso direto agora. Você pode entrar com seu e-mail."}
              <span className="mt-1 block text-xs opacity-70">Código: {sp.falha}</span>
            </Alert>
          </div>
        )}
        <EmailLinkForm action={requestLoginLink} hidden={{ next: `/m/${token}` }} submitLabel="Continuar" />
      </Card>
    </div>
  );
}
