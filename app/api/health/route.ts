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
  let nfcMigration: boolean | null = null;
  let migrations: Record<string, boolean> | null = null;
  let demoReady: boolean | null = null;
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
  return NextResponse.json({ ok, env, database, hasAdmin, nfcMigration, migrations, demoReady }, { headers: { "Cache-Control": "no-store" } });
}
