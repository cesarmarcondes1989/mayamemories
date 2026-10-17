"use server";
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { markEmailVerifiedIfPending } from "@/lib/auth/mark-verified";
import { safeNextPath } from "@/lib/validation/schemas";

const TYPES: EmailOtpType[] = ["email", "magiclink", "invite", "signup", "recovery", "email_change"];

export async function confirmEmailLink(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const rawType = String(formData.get("type") ?? "email") as EmailOtpType;
  const type = TYPES.includes(rawType) ? rawType : "email";
  const next = safeNextPath(String(formData.get("next") ?? ""));
  if (!tokenHash) redirect("/entrar?erro=link");
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    // Já entrou por este link (ex.: tocou duas vezes)? Segue em frente.
    const { data } = await supabase.auth.getUser();
    redirect(data.user ? next : `/entrar?erro=link&next=${encodeURIComponent(next)}`);
  }
  await markEmailVerifiedIfPending(supabase);
  redirect(next);
}
