import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedAutomation } from "@/lib/automation/auth";

export const dynamic = "force-dynamic";

/**
 * Prepara avisos de cápsulas próximas (idempotente). Apenas AVISA:
 * a abertura continua sendo decidida pelo banco a cada acesso.
 */
export async function POST(request: Request) {
  if (!isAuthorizedAutomation(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { days?: number };
  const days = Math.min(Math.max(Number(body.days) || 7, 1), 60);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("enqueue_upcoming_capsule_notices", { p_days: days });
  if (error) return NextResponse.json({ error: "enqueue_failed" }, { status: 500 });
  return NextResponse.json({ enqueued: data ?? 0 });
}
