"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/permissions/viewer";
import { publicEnv } from "@/lib/env";
import { seedDemo } from "./seed";

/** Cria ou recria o Baú da Alice (só o dono da plataforma, com 2 fatores). */
export async function createDemo() {
  const viewer = await requirePlatformAdmin();
  const h = await headers();
  const origin = h.get("origin") ?? publicEnv.siteUrl();
  let result: { vaultId: string; memories: number } | null = null;
  let message = "";
  try {
    result = await seedDemo(origin, viewer.profileId!);
  } catch (e) {
    message = e instanceof Error ? e.message : String(e);
    console.error("[demo] seed", message);
  }
  revalidatePath("/plataforma/demo");
  redirect(result ? `/plataforma/demo?criado=${result.memories}` : `/plataforma/demo?erro=${encodeURIComponent(message.slice(0, 200))}`);
}
