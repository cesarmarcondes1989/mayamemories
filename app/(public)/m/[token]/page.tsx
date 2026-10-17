import type { Metadata } from "next";
import { subjectWords } from "@/lib/subject";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/permissions/viewer";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { BottomTabs } from "@/components/navigation/bottom-tabs";
import { NudgeCard } from "@/components/contributor/nudge-card";
import { getMyStats } from "@/features/memories/stats";
import { Alert } from "@/components/ui/misc";
import { EmailLinkForm } from "@/components/auth/email-form";
import { requestLoginLink } from "@/features/auth/actions";
import { UnavailableMessage } from "@/components/auth/unavailable";
import { HomeActions, HomeHero } from "@/components/contributor/home-actions";
import { GuestJoinForm } from "@/components/events/guest-join-form";
import { EmailOptIn } from "@/components/account/email-opt-in";
import { shouldPromptEmail } from "@/features/account/email-prompt";
import { HeartDoodle } from "@/components/ui/doodles";

type Resolved = {
  state: "active" | "closed" | "unavailable";
  is_my_token: boolean;
  greeting_name: string | null;
  vault_id: string | null;
  token_kind?: "person" | "guest" | "campaign" | null;
  event_id?: string | null;
  event_name?: string | null;
  vault_title?: string | null;
};

function EventActions({ eventId, eventName }: { eventId: string; eventName: string }) {
  const q = `?evento=${eventId}`;
  return (
    <Card className="mb-6 p-6 text-center">
      <p className="text-xs font-bold tracking-[0.16em] text-taupe uppercase">Você está no</p>
      <h2 className="mt-1 text-5xl text-rose-deep">🎉 {eventName}</h2>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <ButtonLink href={`/enviar/foto${q}`} size="lg">📸 Foto ou vídeo</ButtonLink>
        <ButtonLink href={`/enviar/mensagem${q}`} size="lg" variant="secondary">💌 Recado</ButtonLink>
        <ButtonLink href={`/enviar/audio${q}`} size="lg" variant="secondary">🎙️ Áudio</ButtonLink>
      </div>
      <ButtonLink href={`/linha-do-tempo${q}`} variant="ghost" className="mt-3">Ver o álbum da festa →</ButtonLink>
    </Card>
  );
}

export const metadata: Metadata = { title: "Ursinho" };
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
  const resolved = (Array.isArray(data) ? data[0] : null) as Resolved | null;
  if (resolved?.state === "closed") {
    return (
      <UnavailableMessage reason={`${resolved.event_name ?? "Este evento"} já foi encerrado. Obrigado por ter feito parte ♡`} />
    );
  }
  if (!resolved || resolved.state !== "active") {
    return <UnavailableMessage reason="Este chaveiro foi desativado ou substituído." />;
  }
  const isGuestToken = resolved.token_kind === "guest";

  if (resolved.is_my_token && resolved.vault_id) {
    const viewer = await getViewer();
    // O token abre SEMPRE no baú dele: se o baú em uso é outro, troca.
    if (viewer?.vault?.id !== resolved.vault_id) {
      redirect(
        isGuestToken
          ? `/baus/${resolved.vault_id}?para=/m/${encodeURIComponent(token)}`
          : `/m/${encodeURIComponent(token)}/entrar`,
      );
    }
    const [, stats, promptEmail] = await Promise.all([
      supabase.rpc("touch_last_seen"),
      getMyStats(resolved.vault_id),
      shouldPromptEmail(viewer),
    ]);
    return (
      <div className="mx-auto max-w-3xl pt-2 pb-24 md:pb-0">
        <BottomTabs />
        <HomeHero name={resolved.greeting_name ?? viewer?.displayName.split(" ")[0]} subject={subjectWords(viewer?.vault).of} pronoun={subjectWords(viewer?.vault).pronoun} />
        {isGuestToken && resolved.event_id && <EventActions eventId={resolved.event_id} eventName={resolved.event_name ?? "evento"} />}
        {promptEmail && <EmailOptIn pendingEmail={viewer?.pendingEmail} className="mb-6" />}
        <NudgeCard stats={stats} />
        <HomeActions />
        {viewer?.isAdmin && (
          <div className="mt-8 text-center">
            <ButtonLink href="/admin" variant="secondary">
              ⚙︎ Ir para o painel de administração
            </ButtonLink>
          </div>
        )}
      </div>
    );
  }

  // Mesa do evento: quem chega diz o nome e entra como convidado.
  if (isGuestToken) {
    const viewer = await getViewer();
    return (
      <div className="mx-auto max-w-md pt-4 text-center">
        <HeartDoodle className="mx-auto size-14 text-rose-deep" />
        <p className="mt-3 text-sm font-semibold tracking-wide text-taupe uppercase">{resolved.vault_title}</p>
        <h1 className="mt-1 text-6xl">{resolved.event_name} 🎉</h1>
        <p className="mt-3 text-[15px] text-taupe">
          Que bom ter você aqui! Deixe fotos, vídeos e recados deste dia. Tudo fica guardado num baú privado da família — só quem estava aqui vê o álbum.
        </p>
        <Card className="mt-8 p-6 text-left">
          <GuestJoinForm token={token} defaultName={viewer?.displayName || undefined} />
        </Card>
      </div>
    );
  }

  // Ainda não é a pessoa do ursinho neste celular: entra direto como ela.
  if (!sp.falha && !sp.admin) redirect(`/m/${encodeURIComponent(token)}/entrar`);

  // Ursinho de administrador (ou falha de configuração): entra por e-mail.
  const viewer = await getViewer();
  return (
    <div className="mx-auto max-w-md pt-4 text-center">
      <p className="font-display text-7xl">♡</p>
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
                ? "Este ursinho ainda não está ligado a uma pessoa. Peça a quem cuida do baú para vinculá-lo."
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
