import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { INVITE_COOKIE } from "@/features/auth/constants";

/** Conclui o convite depois do link mágico (segredo em cookie ou e-mail comprovado). */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/entrar", origin));

  const secret = request.cookies.get(INVITE_COOKIE)?.value;
  const { error } = secret
    ? await supabase.rpc("accept_invitation", { p_secret: secret })
    : await supabase.rpc("accept_invitations_for_my_email");

  let target = "/boas-vindas";
  if (error) {
    const { data: personId } = await supabase.rpc("current_person_id");
    target = personId ? "/inicio" : `/acesso-indisponivel?motivo=${encodeURIComponent(friendlyError(error))}`;
  } else if (!secret) {
    const { data: personId } = await supabase.rpc("current_person_id");
    if (!personId) target = "/acesso-indisponivel?motivo=sem-convite";
  }
  const response = NextResponse.redirect(new URL(target, origin));
  response.cookies.delete(INVITE_COOKIE);
  return response;
}
