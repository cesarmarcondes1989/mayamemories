import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Validade curta, compatível com a reprodução de vídeos longos. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Emite URLs assinadas usando o cliente DO USUÁRIO: o Storage só assina o
 * que a política de leitura (memory_viewable) permite.
 */
export async function signMediaPaths(supabase: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await supabase.storage.from("memories").createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) out[item.path] = item.signedUrl;
  }
  return out;
}
