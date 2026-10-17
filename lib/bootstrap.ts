import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Primeiro acesso pelo site (sem rodar script):
 * só vale enquanto NÃO existe nenhum administrador e só para e-mails listados
 * em ADMIN_BOOTSTRAP_EMAILS (variável de ambiente no servidor). A posse do
 * e-mail é comprovada pelo link mágico. Depois do primeiro admin, desliga sozinho.
 */
export function bootstrapEmails(): string[] {
  return (process.env.ADMIN_BOOTSTRAP_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function adminExists(): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("platform_admins")
    .select("profile_id", { count: "exact", head: true });
  if (error) throw new Error(`admin check failed: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function canBootstrap(email: string): Promise<boolean> {
  if (!bootstrapEmails().includes(email.toLowerCase())) return false;
  return !(await adminExists());
}
