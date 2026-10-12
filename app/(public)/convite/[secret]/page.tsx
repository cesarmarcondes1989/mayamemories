import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { EmailLinkForm } from "@/components/auth/email-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { acceptInviteNow, requestInviteLink } from "@/features/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { UnavailableMessage } from "@/components/auth/unavailable";

export const metadata: Metadata = { title: "Convite" };

export default async function InvitePage({ params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const supabase = await createClient();
  const [{ data: rows }, { data: auth }] = await Promise.all([
    supabase.rpc("check_invitation", { p_secret: secret }),
    supabase.auth.getUser(),
  ]);
  const invite = Array.isArray(rows) ? rows[0] : null;
  if (!invite?.valid) return <UnavailableMessage reason="Este convite expirou, foi revogado ou já foi utilizado." />;

  return (
    <div className="mx-auto mt-4 max-w-md text-center">
      <p className="text-xs font-medium tracking-[0.2em] text-rose-deep uppercase">Um convite especial</p>
      <h1 className="mt-3 text-5xl leading-tight">
        {invite.first_name ? `${invite.first_name}, você` : "Você"} faz parte da história da Maya.
      </h1>
      <p className="mt-4 text-taupe">
        Este é um espaço para guardar momentos, palavras e lembranças que ela poderá descobrir ao longo da vida.
      </p>
      <Card className="mt-8 p-6 text-left">
        {auth.user ? (
          <form action={acceptInviteNow} className="space-y-4">
            <input type="hidden" name="secret" value={secret} />
            <p className="text-[15px] text-taupe">
              Você está conectado como <strong className="text-ink">{auth.user.email}</strong>.
            </p>
            <SubmitButton size="lg" className="w-full">
              Aceitar convite
            </SubmitButton>
          </form>
        ) : (
          <EmailLinkForm
            action={requestInviteLink}
            hidden={{ secret }}
            submitLabel="Aceitar convite"
            sentMessage="Enviamos um link para o seu e-mail. Abra-o neste mesmo celular para concluir o convite."
          />
        )}
      </Card>
    </div>
  );
}
