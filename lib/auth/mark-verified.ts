import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Chamado depois que a pessoa abriu um link enviado ao e-mail dela: isso
 * comprova a posse do endereço. Contas do cadastro aberto passam a valer
 * para convites a partir daqui.
 */
export async function markEmailVerifiedIfPending(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || user.app_metadata?.email_verified !== false) return;
  const { error } = await createAdminClient().auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, email_verified: true },
  });
  if (error) return console.error("[auth] mark verified", error.message);
  await supabase.auth.refreshSession();
}
