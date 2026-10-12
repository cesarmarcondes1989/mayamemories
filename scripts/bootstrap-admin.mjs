#!/usr/bin/env node
// Inicialização segura do PRIMEIRO administrador.
// - Não existe senha padrão: o acesso é por link mágico enviado ao e-mail.
// - Só funciona enquanto não houver nenhum administrador (o banco recusa depois).
// Uso: npm run bootstrap:admin -- cesar@email.com "Cesar" pai
import { createClient } from "@supabase/supabase-js";
import { need } from "./_env.mjs";

const [email, displayName, relationship = "pai"] = process.argv.slice(2);
if (!email || !displayName) {
  console.error('Uso: npm run bootstrap:admin -- <email> "<Nome>" [pai|mae|...]');
  process.exit(1);
}

const url = process.env.SUPABASE_URL || need("NEXT_PUBLIC_SUPABASE_URL");
const supabase = createClient(url, need("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

// 1) Garante o usuário no Auth (convite por e-mail, sem senha)
const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
  redirectTo: `${site}/admin`,
  data: { display_name: displayName },
});
if (inviteError && !/already|registered|exists/i.test(inviteError.message)) {
  console.error("Falha ao convidar:", inviteError.message);
  process.exit(1);
}

// 2) Promove a administrador (o banco recusa se já existir um admin)
const { data, error } = await supabase.rpc("bootstrap_first_admin", {
  p_email: email,
  p_display_name: displayName,
  p_relationship: relationship,
});
if (error) {
  console.error("Não foi possível criar o administrador:", error.message);
  process.exit(1);
}
console.log(`✓ Administrador criado (perfil ${data}).`);
console.log(inviteError ? "  A conta já existia: entre em /entrar com este e-mail." : `  Um e-mail de convite foi enviado para ${email}.`);
console.log("  Adicione o segundo administrador pelo painel: Pessoas → Convidar → Permissões → Administrador.");
