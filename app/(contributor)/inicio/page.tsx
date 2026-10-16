import type { Metadata } from "next";
import { requireMember } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { HomeActions, HomeHero } from "@/components/contributor/home-actions";
import { NudgeCard } from "@/components/contributor/nudge-card";
import { getMyStats } from "@/features/memories/stats";

export const metadata: Metadata = { title: "Início" };

export default async function ContributorHome() {
  const viewer = await requireMember();
  const supabase = await createClient();
  const [, stats] = await Promise.all([supabase.rpc("touch_last_seen"), getMyStats()]);
  return (
    <div className="mx-auto max-w-3xl">
      <HomeHero name={viewer.displayName.split(" ")[0]} />
      {viewer.canContribute && <NudgeCard stats={stats} />}
      {viewer.canContribute ? (
        <HomeActions />
      ) : (
        <p className="text-taupe">Explore a linha do tempo e as cápsulas abertas.</p>
      )}
    </div>
  );
}
