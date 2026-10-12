"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { emailSchema, safeNextPath } from "@/lib/validation/schemas";
import { friendlyError } from "@/lib/errors";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

import { INVITE_COOKIE } from "./constants";

/**
 * Envia um link de acesso. Cadastros públicos ficam DESLIGADOS no Supabase:
 * contas novas só nascem por convite (Admin API), depois que o servidor
 * conferiu que existe um convite válido. A resposta ao usuário é sempre
 * genérica para não revelar quem está cadastrado.
 * O link aponta para /auth/confirm (token_hash) — veja docs/deployment.md.
 */
async function sendMagicLink(email: string, next: string, allowCreate: boolean) {
  const redirectTo = `${publicEnv.siteUrl()}${next}`;
  if (allowCreate) {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (!error) return;
    if (!/already|registered|exists/i.test(error.message)) {
      console.error("[auth] inviteUserByEmail", error.message);
      return;
    }
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
  });
  if (error && /rate limit|security purposes/i.test(error.message)) {
    throw new Error("Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.");
  }
  if (error && !/signups not allowed|user not found|otp_disabled/i.test(error.message)) {
    console.error("[auth] signInWithOtp", error.message);
  }
}

export async function requestLoginLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", message: "Informe um e-mail válido." };
  const next = safeNextPath(String(formData.get("next") ?? ""), "/inicio");
  try {
    const admin = createAdminClient();
    const { data: invited } = await admin.rpc("email_has_pending_invitation", { p_email: parsed.data });
    await sendMagicLink(parsed.data, invited ? "/convite/concluir" : next, Boolean(invited));
  } catch (e) {
    return { status: "error", message: e instanceof Error && e.message.startsWith("Muitas") ? e.message : friendlyError(e) };
  }
  return { status: "sent" };
}

/** Link de convite (segredo): valida e guarda o segredo em cookie httpOnly curto. */
export async function requestInviteLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const secret = String(formData.get("secret") ?? "");
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", message: "Informe um e-mail válido." };
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("invitation_email_allowed", { p_secret: secret, p_email: parsed.data });
  if (!allowed) {
    return { status: "error", message: "Este convite não pode ser usado com este e-mail. Confira o endereço ou fale com os pais da Maya." };
  }
  const store = await cookies();
  store.set(INVITE_COOKIE, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  try {
    await sendMagicLink(parsed.data, "/convite/concluir", true);
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : friendlyError(e) };
  }
  return { status: "sent" };
}

/** Já autenticado: aceita o convite diretamente. */
export async function acceptInviteNow(formData: FormData) {
  const secret = String(formData.get("secret") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_secret: secret });
  if (error) redirect(`/acesso-indisponivel?motivo=${encodeURIComponent(friendlyError(error))}`);
  redirect("/boas-vindas");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
