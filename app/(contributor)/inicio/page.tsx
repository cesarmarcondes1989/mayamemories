import type { Metadata } from "next";
import { requireMember } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { HomeActions, HomeHero } from "@/components/contributor/home-actions";

export const metadata: Metadata = { title: "Início" };

export default async function ContributorHome() {
  const viewer = await requireMember();
  const supabase = await createClient();
  await supabase.rpc("touch_last_seen");
  return (
    <div className="mx-auto max-w-3xl">
      <HomeHero name={viewer.displayName.split(" ")[0]} />
      {viewer.canContribute ? (
        <HomeActions />
      ) : (
        <p className="text-taupe">Explore a linha do tempo e as cápsulas abertas.</p>
      )}
    </div>
  );
}
