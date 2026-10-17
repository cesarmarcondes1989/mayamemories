"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/permissions/viewer";
import { publicEnv } from "@/lib/env";
import { EMAIL_PROMPT_SKIP_COOKIE } from "@/lib/email-identity";

export type EmailState = { ok: boolean; sentTo?: string; error?: string };

/**
 * E-mail opcional para quem entrou pelo ursinho/mesa. A troca só vale depois
 * que a pessoa confirma no próprio e-mail (prova de que ele é dela) — assim
 * ninguém "pega" convites de outra pessoa digitando o e-mail dela.
 */
export async function saveMyEmail(_prev: EmailState, formData: FormData): Promise<EmailState> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sua sessão expirou. Encoste o ursinho de novo." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    return { ok: false, error: "Esse e-mail parece incompleto." };
  }
  if (email === viewer.email?.toLowerCase()) return { ok: true, sentTo: email };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${publicEnv.siteUrl()}/inicio?email=confirmado` },
  );
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return { ok: false, error: "Esse e-mail já tem uma conta aqui. Se for seu, use “Entrar” com ele." };
    }
    if (/rate|too many|security purposes/i.test(error.message)) {
      return { ok: false, error: "Acabamos de enviar um link. Espere um minutinho e tente de novo." };
    }
    console.error("[account] email change", error.message);
    return { ok: false, error: "Não conseguimos enviar a confirmação agora. Tente mais tarde." };
  }
  return { ok: true, sentTo: email };
}

export async function dismissEmailPrompt() {
  const store = await cookies();
  store.set(EMAIL_PROMPT_SKIP_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 60 });
  revalidatePath("/", "layout");
}
