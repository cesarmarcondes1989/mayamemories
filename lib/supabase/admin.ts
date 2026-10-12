import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Cliente com service role. IGNORA o RLS.
 * Uso restrito a operações privilegiadas e pontuais no servidor:
 *  - verificação de arquivos enviados (assinatura real do arquivo);
 *  - envio de links de convite;
 *  - rotas de automação autenticadas (n8n);
 *  - limpeza de arquivos de memórias removidas.
 * Nunca importar em componentes de cliente.
 */
export function createAdminClient() {
  return createClient(publicEnv.supabaseUrl(), serverEnv.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
