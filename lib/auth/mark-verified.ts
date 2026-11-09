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
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, email_verified: true },
  });
  if (error) return console.error("[auth] mark verified", error.message);
  // Quem criou a conta com este e-mail antes da prova pode não ser o dono dele:
  // derruba as outras sessões e os fatores de 2 etapas cadastrados até aqui.
  const { data: session } = await supabase.auth.getSession();
  if (session.session) {
    const { error: outError } = await admin.auth.admin.signOut(session.session.access_token, "others");
    if (outError) console.error("[auth] revoke other sessions", outError.message);
  }
  const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
  for (const f of factors?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id });
  await supabase.auth.refreshSession();
}
