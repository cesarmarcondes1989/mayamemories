"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/browser";

/**
 * Compatibilidade com os templates de e-mail PADRÃO do Supabase: convites
 * chegam com #access_token=… (fragmento, invisível ao servidor). Guardamos a
 * sessão em cookies e seguimos o fluxo normal no servidor.
 */
export function HashSessionHandler() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("error_code")) {
      // Link expirado/já usado: tira o erro da barra e leva para "entrar" com o aviso
      history.replaceState(null, "", window.location.pathname + window.location.search);
      if (!/erro=link|error_code/.test(window.location.search)) window.location.replace("/entrar?erro=link");
      return;
    }
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (!access_token || !refresh_token) return;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => window.location.replace(error ? "/entrar?erro=link" : "/auth/continuar"));
  }, []);
  return null;
}
