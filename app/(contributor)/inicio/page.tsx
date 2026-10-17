import type { Metadata } from "next";
import { subjectWords } from "@/lib/subject";
import { requireMember } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { HomeActions, HomeHero } from "@/components/contributor/home-actions";
import { NudgeCard } from "@/components/contributor/nudge-card";
import { getMyStats } from "@/features/memories/stats";
import { EmailOptIn } from "@/components/account/email-opt-in";
import { shouldPromptEmail } from "@/features/account/email-prompt";
import { Alert } from "@/components/ui/misc";
import { VerifyEmailBanner } from "@/components/account/verify-email-banner";

export const metadata: Metadata = { title: "Início" };

export default async function ContributorHome({ searchParams }: { searchParams: Promise<{ email?: string; link?: string }> }) {
  const viewer = await requireMember();
  const { email, link } = await searchParams;
  const supabase = await createClient();
  const [, stats, promptEmail] = await Promise.all([supabase.rpc("touch_last_seen"), getMyStats(viewer.vault.id), shouldPromptEmail(viewer)]);
  return (
    <div className="mx-auto max-w-3xl">
      {email === "confirmado" && viewer.hasRealEmail && (
        <div className="mb-4"><Alert tone="success">E-mail confirmado ♡ Agora você também entra por ele.</Alert></div>
      )}
      {!viewer.emailVerified && <VerifyEmailBanner email={viewer.email} sent={link === "enviado"} />}
      <HomeHero name={viewer.displayName.split(" ")[0]} subject={subjectWords(viewer.vault).of} pronoun={subjectWords(viewer.vault).pronoun} />
      {promptEmail && <EmailOptIn pendingEmail={viewer.pendingEmail} className="mb-6" />}
      {viewer.canContribute && <NudgeCard stats={stats} />}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <a href={`/filme/${new Date().getFullYear()}`} className="rounded-3xl bg-paper p-4 shadow-[var(--shadow-soft)]">
          <span className="text-2xl" aria-hidden="true">🎬</span>
          <span className="mt-1 block font-semibold text-rose-deep">O filme do ano</span>
          <span className="text-sm text-taupe">montado sozinho com tudo que a família guardou</span>
        </a>
        <a href={`/livro/${new Date().getFullYear()}`} className="rounded-3xl bg-paper p-4 shadow-[var(--shadow-soft)]">
          <span className="text-2xl" aria-hidden="true">📖</span>
          <span className="mt-1 block font-semibold text-rose-deep">O livro do ano</span>
          <span className="text-sm text-taupe">pronto para guardar em PDF ou imprimir</span>
        </a>
      </div>
      {viewer.canContribute ? (
        <HomeActions />
      ) : (
        <p className="text-taupe">Explore a linha do tempo e as cápsulas abertas.</p>
      )}
    </div>
  );
}
