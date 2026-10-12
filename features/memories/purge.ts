import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "memories";

/** Remove arquivos de uma memória já marcada como removida no banco. */
export async function purgeMemoryFiles(memoryId: string) {
  const admin = createAdminClient();
  const { data: memory } = await admin.from("memories").select("moderation_status").eq("id", memoryId).maybeSingle();
  if (memory?.moderation_status !== "removed") return;
  const { data: assets } = await admin.from("media_assets").select("id, storage_path").eq("memory_id", memoryId);
  const paths = (assets ?? []).map((a) => a.storage_path);
  if (paths.length) await admin.storage.from(BUCKET).remove(paths);
  await admin.from("media_assets").update({ processing_status: "deleted" }).eq("memory_id", memoryId);
}

