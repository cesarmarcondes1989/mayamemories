import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = [
  "/inicio", "/enviar", "/cartas", "/visitas", "/minhas-memorias", "/linha-do-tempo",
  "/memoria", "/capsulas", "/perfil", "/boas-vindas", "/obrigado", "/admin", "/baus", "/plataforma", "/imprimir",
];

export async function updateSession(request: NextRequest) {
  // Templates de e-mail padrão do Supabase devolvem ?code= no destino final:
  // encaminhamos para a troca de código (fluxo PKCE).
  const code = request.nextUrl.searchParams.get("code");
  if (code && !request.nextUrl.pathname.startsWith("/auth/")) {
    const target = request.nextUrl.clone();
    target.searchParams.delete("code");
    const callback = new URL("/auth/callback", request.nextUrl.origin);
    callback.searchParams.set("code", code);
    callback.searchParams.set("next", target.pathname + target.search);
    return NextResponse.redirect(callback);
  }

  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Renova a sessão. Não remover: mantém os cookies de autenticação válidos.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);

  const path = request.nextUrl.pathname;
  if (!isAuthenticated && PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/entrar";
    redirect.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(redirect);
  }
  return response;
}
