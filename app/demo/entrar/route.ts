import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CURRENT_VAULT_COOKIE } from "@/lib/permissions/vault-cookie";
import { DEMO_EMAILS } from "@/features/demo/data";

export const dynamic = "force-dynamic";

/**
 * As contas da demo são compartilhadas: se alguém trocou o e-mail ou cadastrou
 * 2 fatores direto na API de login, desfazemos aqui antes de cada entrada.
 */
async function resetDemoAccounts(admin: ReturnType<typeof createAdminClient>, vaultId: string) {
  const { data: profiles } = await admin.from("profiles").select("id, auth_user_id").eq("is_demo", true);
  const { data: admins } = await admin.from("person_roles").select("profile_id").eq("vault_id", vaultId).eq("role", "admin").is("revoked_at", null);
  const adminIds = new Set((admins ?? []).map((r) => r.profile_id));
  for (const p of profiles ?? []) {
    if (!p.auth_user_id) continue;
    const canonical = adminIds.has(p.id) ? DEMO_EMAILS.admin : DEMO_EMAILS.family;
    const { data } = await admin.auth.admin.getUserById(p.auth_user_id);
    if (data.user && data.user.email?.toLowerCase() !== canonical) {
      await admin.auth.admin.updateUserById(p.auth_user_id, { email: canonical, email_confirm: true });
    }
    const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: p.auth_user_id });
    for (const f of factors?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: p.auth_user_id });
  }
}

/**
 * Entra no baú de demonstração como família ou como administradora.
 * As contas são compartilhadas e o banco recusa qualquer alteração na demo.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const asAdmin = request.nextUrl.searchParams.get("como") === "admin";
  const fail = () => NextResponse.redirect(new URL("/demo?indisponivel=1", origin));
  // Troca a sessão de quem chega: só a partir do próprio site ou de um link aberto direto
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return NextResponse.redirect(new URL("/demo", origin));
  try {
    const admin = createAdminClient();
    const { data: vaultId, error: demoError } = await admin.rpc("demo_vault_id");
    if (demoError) console.error("[demo] demo_vault_id", demoError.message);
    if (!vaultId) return fail();
    const email = asAdmin ? DEMO_EMAILS.admin : DEMO_EMAILS.family;
    await resetDemoAccounts(admin, vaultId as string);
    const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !link?.properties?.hashed_token) {
      console.error("[demo] generateLink", error?.message);
      return fail();
    }
    const supabase = await createClient();
    await supabase.auth.signOut();
    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
    if (verifyError) {
      console.error("[demo] verifyOtp", verifyError.message);
      return fail();
    }
    const res = NextResponse.redirect(new URL(asAdmin ? "/admin" : "/inicio", origin));
    res.cookies.set(CURRENT_VAULT_COOKIE, vaultId as string, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
    return res;
  } catch (e) {
    console.error("[demo] entrar", e instanceof Error ? e.message : e);
    return fail();
  }
}
