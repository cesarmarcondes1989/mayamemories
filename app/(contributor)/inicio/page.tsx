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

export const metadata: Metadata = { title: "Início" };

export default async function ContributorHome({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const viewer = await requireMember();
  const { email } = await searchParams;
  const supabase = await createClient();
  const [, stats, promptEmail] = await Promise.all([supabase.rpc("touch_last_seen"), getMyStats(viewer.vault.id), shouldPromptEmail(viewer)]);
  return (
    <div className="mx-auto max-w-3xl">
      {email === "confirmado" && viewer.hasRealEmail && (
        <div className="mb-4"><Alert tone="success">E-mail confirmado ♡ Agora você também entra por ele.</Alert></div>
      )}
      <HomeHero name={viewer.displayName.split(" ")[0]} subject={subjectWords(viewer.vault).of} pronoun={subjectWords(viewer.vault).pronoun} />
      {promptEmail && <EmailOptIn pendingEmail={viewer.pendingEmail} className="mb-6" />}
      {viewer.canContribute && <NudgeCard stats={stats} />}
      {viewer.canContribute ? (
        <HomeActions />
      ) : (
        <p className="text-taupe">Explore a linha do tempo e as cápsulas abertas.</p>
      )}
    </div>
  );
}
