import { NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedAutomation } from "@/lib/automation/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "memories";
const DAY = 24 * 60 * 60 * 1000;

/** A Vercel chama o cron com "Authorization: Bearer $CRON_SECRET". */
function isVercelCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const header = request.headers.get("authorization") ?? "";
  if (secret.length < 16 || !header.startsWith("Bearer ")) return false;
  const a = createHash("sha256").update(header.slice(7)).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

/**
 * Limpeza diária (vercel.json → crons): arquivos enviados e nunca verificados
 * e rascunhos abandonados somem depois de 1–2 dias. Assim ninguém ocupa espaço
 * fora da cota com uploads que nunca terminaram.
 */
export async function GET(request: Request) {
  if (!isVercelCron(request) && !isAuthorizedAutomation(request)) return new NextResponse(null, { status: 401 });
  const admin = createAdminClient();
  const cutoff = (ms: number) => new Date(Date.now() - ms).toISOString();

  // 1. Arquivos que nunca chegaram a ser verificados
  const { data: stale } = await admin
    .from("media_assets")
    .select("id, storage_path")
    .in("processing_status", ["pending_upload", "failed"])
    .lt("created_at", cutoff(DAY))
    .limit(500);
  if (stale?.length) {
    await admin.storage.from(BUCKET).remove(stale.map((a) => a.storage_path));
    await admin.from("media_assets").delete().in("id", stale.map((a) => a.id));
  }

  // 2. Rascunhos abandonados (o envio nunca terminou)
  const { data: drafts } = await admin
    .from("memories")
    .select("id, media_assets(storage_path)")
    .in("moderation_status", ["draft", "uploading"])
    .lt("created_at", cutoff(2 * DAY))
    .limit(200);
  if (drafts?.length) {
    const paths = drafts.flatMap((m) => (m.media_assets ?? []).map((a: { storage_path: string }) => a.storage_path));
    if (paths.length) await admin.storage.from(BUCKET).remove(paths);
    await admin.from("memories").delete().in("id", drafts.map((m) => m.id));
  }

  return NextResponse.json({ ok: true, assets: stale?.length ?? 0, drafts: drafts?.length ?? 0 });
}
