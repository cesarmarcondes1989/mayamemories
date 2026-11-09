import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminExists, bootstrapEmails } from "@/lib/bootstrap";
import { getViewer } from "@/lib/permissions/viewer";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico de configuração. Para o público: só "ok". O detalhe (variáveis,
 * migrações, se já existe admin) aparece apenas para o dono da plataforma logado.
 */
export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_SITE_URL: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    ADMIN_BOOTSTRAP_EMAILS: bootstrapEmails().length > 0,
  };
  // Opcional (livro/filme com IA): não entra no "ok"
  const optional = { ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY) };
  let database: "ok" | "migrations_missing" | "unreachable" = "unreachable";
  let hasAdmin: boolean | null = null;
  let nfcMigration: boolean | null = null;
  let migrations: Record<string, boolean> | null = null;
  let demoReady: boolean | null = null;
  let detailed = false;
  try {
    detailed = Boolean((await getViewer())?.isPlatformAdmin);
  } catch {
    detailed = false;
  }
  if (!detailed) {
    let reachable = false;
    if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        reachable = !(await createAdminClient().from("app_settings").select("id").limit(1)).error;
      } catch {
        reachable = false;
      }
    }
    return NextResponse.json({ ok: Object.values(env).every(Boolean) && reachable }, { headers: { "Cache-Control": "no-store" } });
  }
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { error } = await createAdminClient().from("app_settings").select("id").limit(1);
      database = error ? (/does not exist|schema cache/i.test(error.message) ? "migrations_missing" : "unreachable") : "ok";
      if (database === "ok") {
        hasAdmin = await adminExists();
        const { error: fnError } = await createAdminClient().rpc("nfc_login_target", { p_public_id: "health-check-0000" });
        nfcMigration = !fnError;
        // Sondas baratas: uma coluna/tabela característica de cada migration
        const admin = createAdminClient();
        const probe = async (table: string, column: string) => !(await admin.from(table).select(column).limit(1)).error;
        migrations = {
          "009_multi_vault": await probe("vaults", "id"),
          "010_plans_and_leads": await probe("plans", "key"),
          "011_vault_events": await probe("vault_events", "id"),
          "012_platform_security_analytics": await probe("analytics_events", "id"),
          "013_self_signup": await probe("app_settings", "self_service_vault_limit"),
          "014_brand_guardei": await probe("app_settings", "brand_name"),
          "015_demo_vault": await probe("vaults", "is_demo"),
          "016_story_texts": await probe("story_selections", "kind"),
          "017_story_films": await probe("story_films", "source"),
          "018_security_hardening": !(await admin.rpc("rate_limit_hit", { p_key: "health", p_window_seconds: 1, p_max: 1000 })).error,
        };
        if (migrations["015_demo_vault"]) {
          const { data } = await admin.rpc("demo_vault_id");
          demoReady = Boolean(data);
        }
      }
    } catch {
      database = "unreachable";
    }
  }
  const ok = Object.values(env).every(Boolean) && database === "ok";
  return NextResponse.json({ ok, env, optional, database, hasAdmin, nfcMigration, migrations, demoReady }, { headers: { "Cache-Control": "no-store" } });
}
