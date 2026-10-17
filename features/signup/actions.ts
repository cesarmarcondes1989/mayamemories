"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { emailSchema } from "@/lib/validation/schemas";
import { CURRENT_VAULT_COOKIE } from "@/lib/permissions/vault-cookie";
import { createVaultAsUser, vaultSchema } from "@/features/vaults/create";
import { parseUserAgent } from "@/lib/analytics/ua";

export type SignupState = { status: "idle" | "error" | "exists"; message?: string; fields?: Record<string, string> };

/**
 * Cadastro aberto: cria a conta, abre a sessão e cria o baú (Grátis) num passo só.
 * O e-mail fica "não confirmado" (app_metadata.email_verified = false) até a
 * pessoa clicar no link que enviamos — até lá ela usa o próprio baú, mas o
 * e-mail não serve para aceitar convites de outros baús (trava no banco).
 */
export async function signUp(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const fields = Object.fromEntries(Object.entries(raw).filter(([k]) => !["website", "startedAt"].includes(k)));
  const wantedPlan = /^[a-z0-9_]{2,30}$/.test(raw.plano ?? "") && raw.plano !== "gratis" ? raw.plano : null;
  // Armadilhas para robôs: campo invisível e formulário preenchido rápido demais
  if (raw.website || Date.now() - Number(raw.startedAt || 0) < 2500) {
    return { status: "error", message: "Algo não saiu como esperado. Tente de novo.", fields };
  }
  const email = emailSchema.safeParse(raw.email);
  if (!email.success) return { status: "error", message: "Informe um e-mail válido.", fields };
  if (raw.terms !== "on") return { status: "error", message: "Para criar a conta, aceite os termos e a privacidade.", fields };
  const vault = vaultSchema.safeParse({ ...raw, myName: raw.myName });
  if (!vault.success) return { status: "error", message: vault.error.issues[0]?.message, fields };

  const admin = createAdminClient();
  const { data: settings } = await admin.from("app_settings").select("self_service_vaults").maybeSingle();
  if (!settings?.self_service_vaults) {
    return { status: "error", message: "O cadastro está pausado no momento. Deixe seu contato na página inicial.", fields };
  }

  const site = publicEnv.siteUrl();
  const supabase = await createClient();
  const { error: createError } = await admin.auth.admin.createUser({
    email: email.data,
    email_confirm: true,
    user_metadata: { display_name: vault.data.myName, terms_accepted_at: new Date().toISOString(), via: "signup", wanted_plan: wantedPlan },
    app_metadata: { email_verified: false },
  });
  if (createError) {
    if (/already|registered|exists/i.test(createError.message)) {
      // Já tem conta: manda o link de acesso (sem revelar mais nada)
      await supabase.auth.signInWithOtp({ email: email.data, options: { shouldCreateUser: false, emailRedirectTo: `${site}/baus` } });
      return { status: "exists", message: email.data };
    }
    console.error("[signup] createUser", createError.message);
    return { status: "error", message: "Não conseguimos criar sua conta agora. Tente em instantes.", fields };
  }

  // Abre a sessão aqui mesmo (o link é gerado e consumido no servidor)
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: email.data });
  const hashed = link?.properties?.hashed_token;
  const { error: sessionError } = hashed
    ? await supabase.auth.verifyOtp({ token_hash: hashed, type: "magiclink" })
    : { error: new Error("no token") };
  if (sessionError) {
    console.error("[signup] session", sessionError.message);
    return { status: "exists", message: email.data };
  }

  const created = await createVaultAsUser(supabase, vault.data);
  if ("error" in created) redirect(`/baus?erro=${encodeURIComponent(created.error)}`);

  // Link de confirmação do e-mail (não bloqueia o uso)
  await supabase.auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${site}/admin?email=confirmado` },
  });

  // Quis um plano pago: vira interessado para o dono da plataforma fechar
  if (wantedPlan) {
    await admin.from("leads").insert({
      name: vault.data.myName.slice(0, 120),
      email: email.data,
      kind: vault.data.kind,
      plan_key: wantedPlan,
      source: "cadastro",
      message: `Criou o baú "${vault.data.subjectName}" no Grátis e quer o plano ${wantedPlan}.`,
    }).then(({ error }) => error && console.error("[signup] lead", error.message));
  }

  const ua = parseUserAgent((await headers()).get("user-agent"));
  await admin.from("analytics_events").insert({ event: "signup_done", path: "/comecar", device: ua.device, browser: ua.browser, os: ua.os, logged_in: true });

  (await cookies()).set(CURRENT_VAULT_COOKIE, created.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/admin?novo=1");
}

/** Reenvia o link de confirmação do e-mail. */
export async function resendVerification() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user?.email) {
    await supabase.auth.signInWithOtp({
      email: data.user.email,
      options: { shouldCreateUser: false, emailRedirectTo: `${publicEnv.siteUrl()}/inicio?email=confirmado` },
    });
  }
  redirect("/inicio?link=enviado");
}
