import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminExists, bootstrapEmails } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

/** Diagnóstico de configuração. Só booleanos — nenhum valor secreto. */
export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_SITE_URL: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    ADMIN_BOOTSTRAP_EMAILS: bootstrapEmails().length > 0,
  };
  let database: "ok" | "migrations_missing" | "unreachable" = "unreachable";
  let hasAdmin: boolean | null = null;
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { error } = await createAdminClient().from("app_settings").select("id").limit(1);
      database = error ? (/does not exist|schema cache/i.test(error.message) ? "migrations_missing" : "unreachable") : "ok";
      if (database === "ok") hasAdmin = await adminExists();
    } catch {
      database = "unreachable";
    }
  }
  const ok = Object.values(env).every(Boolean) && database === "ok";
  return NextResponse.json({ ok, env, database, hasAdmin }, { headers: { "Cache-Control": "no-store" } });
}
