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
