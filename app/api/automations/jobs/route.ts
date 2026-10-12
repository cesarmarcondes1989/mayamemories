import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedAutomation } from "@/lib/automation/auth";

export const dynamic = "force-dynamic";

/**
 * n8n busca notificações pendentes. Cada job é reservado atomicamente
 * (FOR UPDATE SKIP LOCKED) e possui dedupe_key: sem duplicidade.
 * Não concede nenhum acesso administrativo além da fila.
 */
export async function POST(request: Request) {
  if (!isAuthorizedAutomation(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 100);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_notification_jobs", { p_limit: limit });
  if (error) return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
