"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { friendlyError } from "@/lib/errors";
import { guestPlaceholderEmail } from "@/lib/email-identity";
import { CURRENT_VAULT_COOKIE } from "@/lib/permissions/vault-cookie";

export type JoinState = { error?: string };

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * Token de mesa: o convidado diz o nome e entra. Sem e-mail, sem senha.
 * Quem já está logado neste celular entra com a própria conta.
 * O banco (nfc_guest_join, só service role) confere evento aberto e limites.
 */
export async function joinEventAsGuest(token: string, _prev: JoinState, formData: FormData): Promise<JoinState> {
  if (!TOKEN.test(token)) return { error: "Este link não é válido." };
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: "Diga como podemos te chamar." };

  const admin = createAdminClient();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  let userId = auth.user?.id ?? null;
  let email: string | null = null;

  if (!userId) {
    email = guestPlaceholderEmail(new URL(publicEnv.siteUrl()).hostname);
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: name, via: "event" },
    });
    if (error || !created.user) {
      console.error("[event] create guest", error?.message);
      return { error: "Não conseguimos abrir sua entrada agora. Tente de novo." };
    }
    userId = created.user.id;
  }

  const { data, error } = await admin.rpc("nfc_guest_join", { p_public_id: token, p_auth_user_id: userId, p_display_name: name });
  const joined = Array.isArray(data) ? (data[0] as { vault_id: string } | undefined) : undefined;
  if (error || !joined) {
    if (email) await admin.auth.admin.deleteUser(userId);
    return { error: friendlyError(error ?? "join failed", "Não conseguimos te colocar no evento. Tente de novo.") };
  }

  if (email) {
    // Abre a sessão sem enviar e-mail: o link é gerado e consumido aqui.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const hashed = link?.properties?.hashed_token;
    const { error: verifyError } = hashed
      ? await supabase.auth.verifyOtp({ token_hash: hashed, type: "magiclink" })
      : { error: linkError ?? new Error("no token") };
    if (verifyError) {
      console.error("[event] guest session", verifyError.message);
      return { error: "Você entrou no evento, mas a sessão não abriu. Encoste o celular de novo." };
    }
  }

  (await cookies()).set(CURRENT_VAULT_COOKIE, joined.vault_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(`/m/${token}`);
}
