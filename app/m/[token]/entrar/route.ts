import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

type Target = { person_id: string; display_name: string; auth_email: string | null; invitation_email: string | null; is_admin: boolean };

/**
 * Acesso direto pelo ursinho: o token É a identidade da pessoa.
 * Cria (uma vez) a conta dela, abre a sessão sem enviar e-mail e volta para
 * a página do ursinho. Nunca abre sessão de administrador.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = request.nextUrl.origin;
  const back = (query = "") => NextResponse.redirect(new URL(`/m/${encodeURIComponent(token)}${query}`, origin));
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return back("?falha=1");

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("nfc_login_target", { p_public_id: token });
    if (error) throw error;
    const target = (data as Target[] | null)?.[0];
    if (!target) return back("?falha=1");
    if (target.is_admin) return back("?admin=1");

    const host = new URL(publicEnv.siteUrl()).hostname;
    const email = target.auth_email ?? target.invitation_email ?? `nfc-${target.person_id}@${host}`;

    if (!target.auth_email) {
      const { error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { display_name: target.display_name, via: "nfc" },
      });
      if (createError && !/already|registered|exists/i.test(createError.message)) throw createError;
    }

    // Gera o link mágico no servidor (nenhum e-mail é enviado) e o consome aqui.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (linkError || !link?.properties?.hashed_token) throw linkError ?? new Error("generateLink without token");

    const supabase = await createClient();
    const { data: session, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "magiclink",
    });
    if (verifyError || !session.user) throw verifyError ?? new Error("verifyOtp without user");

    const { error: linkPersonError } = await admin.rpc("nfc_link_person", { p_public_id: token, p_auth_user_id: session.user.id });
    if (linkPersonError) {
      await supabase.auth.signOut();
      throw linkPersonError;
    }
    return back();
  } catch (e) {
    console.error("[nfc] direct access", e instanceof Error ? e.message : e);
    return back("?falha=1");
  }
}
