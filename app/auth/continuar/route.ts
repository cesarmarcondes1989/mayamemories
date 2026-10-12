import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canBootstrap } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

/** Depois de qualquer login: primeiro acesso do admin, ou conclusão de convite. */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return NextResponse.redirect(new URL("/entrar", origin));
  const target = (await canBootstrap(data.user.email)) ? "/primeiro-acesso" : "/convite/concluir";
  return NextResponse.redirect(new URL(target, origin));
}
