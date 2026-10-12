import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminExists, bootstrapEmails } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

/** Conclui o primeiro acesso: o e-mail já foi comprovado pelo link mágico. */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  if (!data.user || !email || !data.user.email_confirmed_at) {
    return NextResponse.redirect(new URL("/entrar?erro=link", origin));
  }
  if (!bootstrapEmails().includes(email) || (await adminExists())) {
    return NextResponse.redirect(new URL("/inicio", origin));
  }
  const name = String(data.user.user_metadata?.display_name ?? "") || email.split("@")[0];
  const { error } = await createAdminClient().rpc("bootstrap_first_admin", {
    p_email: email,
    p_display_name: name.slice(0, 120),
    p_relationship: "pai",
  });
  if (error) {
    console.error("[bootstrap] bootstrap_first_admin", error.message);
    return NextResponse.redirect(new URL("/acesso-indisponivel?motivo=Falha%20ao%20criar%20o%20administrador", origin));
  }
  return NextResponse.redirect(new URL("/admin", origin));
}
