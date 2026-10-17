import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { INVITE_COOKIE } from "@/features/auth/constants";
import { CURRENT_VAULT_COOKIE } from "@/lib/permissions/vault-cookie";

/** Conclui o convite depois do link mágico (segredo em cookie ou e-mail comprovado). */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/entrar", origin));

  const secret = request.cookies.get(INVITE_COOKIE)?.value;
  const { data: accepted, error } = secret
    ? await supabase.rpc("accept_invitation", { p_secret: secret })
    : await supabase.rpc("accept_invitations_for_my_email");
  // Abre direto no baú do convite aceito
  let vaultId: string | null = null;
  if (!error && secret && accepted) {
    const { data: person } = await supabase.from("people").select("vault_id").eq("id", accepted as string).maybeSingle();
    vaultId = person?.vault_id ?? null;
  }

  let target = "/inicio";
  const { data: vaults } = await supabase.rpc("my_vaults");
  const hasVault = Array.isArray(vaults) && vaults.length > 0;
  if (error) {
    target = hasVault ? "/inicio" : `/acesso-indisponivel?motivo=${encodeURIComponent(friendlyError(error))}`;
  } else if (!hasVault) {
    target = "/acesso-indisponivel?motivo=sem-convite";
  }
  const response = NextResponse.redirect(new URL(target, origin));
  response.cookies.delete(INVITE_COOKIE);
  if (vaultId) {
    response.cookies.set(CURRENT_VAULT_COOKIE, vaultId, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}
