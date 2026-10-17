import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CURRENT_VAULT_COOKIE } from "@/lib/permissions/vault-cookie";
import { DEMO_EMAILS } from "@/features/demo/data";

export const dynamic = "force-dynamic";

/**
 * Entra no baú de demonstração como família ou como administradora.
 * As contas são compartilhadas e o banco recusa qualquer alteração na demo.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const asAdmin = request.nextUrl.searchParams.get("como") === "admin";
  const fail = () => NextResponse.redirect(new URL("/demo?indisponivel=1", origin));
  try {
    const admin = createAdminClient();
    const { data: vaultId } = await admin.rpc("demo_vault_id");
    if (!vaultId) return fail();
    const email = asAdmin ? DEMO_EMAILS.admin : DEMO_EMAILS.family;
    const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !link?.properties?.hashed_token) return fail();
    const supabase = await createClient();
    await supabase.auth.signOut();
    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
    if (verifyError) return fail();
    const res = NextResponse.redirect(new URL(asAdmin ? "/admin" : "/inicio", origin));
    res.cookies.set(CURRENT_VAULT_COOKIE, vaultId as string, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
    return res;
  } catch (e) {
    console.error("[demo] entrar", e instanceof Error ? e.message : e);
    return fail();
  }
}
