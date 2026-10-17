"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { emailSchema, safeNextPath } from "@/lib/validation/schemas";
import { friendlyError } from "@/lib/errors";
import { canBootstrap } from "@/lib/bootstrap";
import { markEmailVerifiedIfPending } from "@/lib/auth/mark-verified";
import type { EmailOtpType } from "@supabase/supabase-js";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string; next?: string };

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
      throw new Error(`inviteUserByEmail: ${error.message}`);
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
  let destination = next;
  try {
    if (await canBootstrap(parsed.data)) {
      await sendMagicLink(parsed.data, "/primeiro-acesso", true);
      return { status: "sent", email: parsed.data, next: "/primeiro-acesso" };
    }
    const admin = createAdminClient();
    const { data: invited, error } = await admin.rpc("email_has_pending_invitation", { p_email: parsed.data });
    if (error) throw new Error(`invitation check failed: ${error.message}`);
    if (invited) destination = "/convite/concluir";
    await sendMagicLink(parsed.data, destination, Boolean(invited));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.startsWith("Muitas")) return { status: "error", message };
    // Falha de configuração (variáveis, migrações): registra para aparecer nos logs da Vercel
    console.error("[auth] requestLoginLink", message);
    return { status: "error", message: "Não foi possível enviar o link agora. Tente novamente em instantes." };
  }
  return { status: "sent", email: parsed.data, next: destination };
}

/**
 * Plano B do link: o mesmo e-mail traz um código de 6 dígitos. Funciona em
 * qualquer aparelho e não "queima" quando o app de e-mail pré-abre o link.
 */
export async function verifyEmailCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const next = safeNextPath(String(formData.get("next") ?? ""), "/inicio");
  const keep = { email: parsed.success ? parsed.data : undefined, next };
  if (!parsed.success || code.length < 6 || code.length > 10) {
    return { status: "error", message: "Digite o código de 6 dígitos que chegou no e-mail.", ...keep };
  }
  const supabase = await createClient();
  let ok = false;
  // Login comum usa "email"; o primeiro acesso de quem foi convidado usa "invite"
  for (const type of ["email", "invite"] as EmailOtpType[]) {
    const { error } = await supabase.auth.verifyOtp({ email: parsed.data, token: code, type });
    if (!error) {
      ok = true;
      break;
    }
    if (/rate limit|security purposes/i.test(error.message)) {
      return { status: "error", message: "Muitas tentativas. Aguarde um minuto e tente de novo.", ...keep };
    }
  }
  if (!ok) return { status: "error", message: "Código inválido ou expirado. Confira o último e-mail ou peça um novo.", ...keep };
  await markEmailVerifiedIfPending(supabase);
  redirect(next);
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
  return { status: "sent", email: parsed.data, next: "/convite/concluir" };
}

/** Já autenticado: aceita o convite diretamente. */
export async function acceptInviteNow(formData: FormData) {
  const secret = String(formData.get("secret") ?? "");
  const supabase = await createClient();
  const { data: personId, error } = await supabase.rpc("accept_invitation", { p_secret: secret });
  if (error) redirect(`/acesso-indisponivel?motivo=${encodeURIComponent(friendlyError(error))}`);
  const { data: person } = await supabase.from("people").select("vault_id").eq("id", personId as string).maybeSingle();
  redirect(person?.vault_id ? `/baus/${person.vault_id}` : "/inicio");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
