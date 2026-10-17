import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { CURRENT_VAULT_COOKIE } from "@/lib/permissions/vault-cookie";

export const dynamic = "force-dynamic";

type Target = { person_id: string; display_name: string; auth_email: string | null; invitation_email: string | null; is_admin: boolean; vault_id: string };

/**
 * Acesso direto pelo ursinho: o token É a identidade da pessoa.
 * Cria (uma vez) a conta dela, abre a sessão sem enviar e-mail e volta para
 * a página do ursinho. Ursinho de admin abre a mesma página, com atalho para o painel.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = request.nextUrl.origin;
  const back = (query = "", vaultId?: string) => {
    const res = NextResponse.redirect(new URL(`/m/${encodeURIComponent(token)}${query}`, origin));
    if (vaultId) {
      res.cookies.set(CURRENT_VAULT_COOKIE, vaultId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
    }
    return res;
  };
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return back("?falha=1");

  let step = "rpc";
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("nfc_login_target", { p_public_id: token });
    if (error) throw error;
    const target = (data as Target[] | null)?.[0];
    if (!target) return back("?falha=sem-pessoa");
    // Token do baú de demonstração: entra na demo compartilhada, sem criar conta
    const { data: demoVault } = await admin.from("vaults").select("is_demo").eq("id", target.vault_id).maybeSingle();
    if (demoVault?.is_demo) return NextResponse.redirect(new URL("/demo/entrar?como=familia", origin));

    // Já é a pessoa do ursinho neste celular: só troca para o baú dele.
    const current = await createClient();
    const { data: mine } = await current.rpc("resolve_nfc_token", { p_public_id: token });
    const me = Array.isArray(mine) ? mine[0] : null;
    if (me?.is_my_token) return back("", target.vault_id);

    const host = new URL(publicEnv.siteUrl()).hostname;
    const email = target.auth_email ?? target.invitation_email ?? `nfc-${target.person_id}@${host}`;

    step = "conta";
    if (!target.auth_email) {
      const { error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { display_name: target.display_name, via: "nfc" },
      });
      if (createError && !/already|registered|exists/i.test(createError.message)) throw createError;
    }

    step = "link";
    // Gera o link mágico no servidor (nenhum e-mail é enviado) e o consome aqui.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (linkError || !link?.properties?.hashed_token) throw linkError ?? new Error("generateLink without token");

    step = "sessao";
    const supabase = await createClient();
    const { data: session, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "magiclink",
    });
    if (verifyError || !session.user) throw verifyError ?? new Error("verifyOtp without user");

    step = "vinculo";
    const { error: linkPersonError } = await admin.rpc("nfc_link_person", { p_public_id: token, p_auth_user_id: session.user.id });
    if (linkPersonError) {
      await supabase.auth.signOut();
      throw linkPersonError;
    }
    // Ursinho ligado a um evento: a pessoa também vê o álbum dele (ignora banco sem a migration 011)
    await admin.rpc("nfc_link_event", { p_public_id: token, p_person_id: target.person_id });
    return back("", target.vault_id);
  } catch (e) {
    const message = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
    console.error("[nfc] direct access", step, message);
    return back(`?falha=${step}`);
  }
}
