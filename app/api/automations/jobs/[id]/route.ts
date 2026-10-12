import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedAutomation } from "@/lib/automation/auth";

export const dynamic = "force-dynamic";

/** n8n confirma o resultado de um job (sucesso, ou falha com nova tentativa). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedAutomation(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const body = (await request.json().catch(() => ({}))) as { success?: boolean; error?: string };
  const admin = createAdminClient();
  const { error } = await admin.rpc("complete_notification_job", {
    p_job_id: id,
    p_success: body.success === true,
    p_error: body.error ? String(body.error).slice(0, 1000) : null,
  });
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
