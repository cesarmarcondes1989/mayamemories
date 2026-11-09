import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/** IP de quem chamou (a Vercel preenche x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "desconhecido").trim().slice(0, 64);
}

/**
 * Conta uma tentativa e diz se ainda cabe na janela (rate_limit_hit no banco).
 * Se o limitador estiver fora do ar, deixa passar: melhor não travar o login.
 */
export async function allow(key: string, windowSeconds: number, max: number): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", { p_key: key.slice(0, 200), p_window_seconds: windowSeconds, p_max: max });
    if (error) {
      console.error("[rate-limit]", error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error("[rate-limit]", e instanceof Error ? e.message : e);
    return true;
  }
}

export const TOO_MANY = "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
