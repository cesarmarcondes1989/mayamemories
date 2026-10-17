"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/permissions/viewer";
import { CURRENT_VAULT_COOKIE } from "@/lib/permissions/vault-cookie";
import { createVaultAsUser, vaultSchema } from "./create";

export type CreateVaultState = { status: "idle" | "error"; message?: string };

export async function createVault(_prev: CreateVaultState, formData: FormData): Promise<CreateVaultState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar");
  const parsed = vaultSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };
  const created = await createVaultAsUser(await createClient(), parsed.data);
  if ("error" in created) return { status: "error", message: created.error };
  const store = await cookies();
  store.set(CURRENT_VAULT_COOKIE, created.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/admin?novo=1");
}
