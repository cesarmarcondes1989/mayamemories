import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MemoryStats } from "@/lib/nudges";

export async function getMyStats(vaultId: string): Promise<MemoryStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_memory_stats", { p_vault_id: vaultId });
  if (error || !data) return null;
  return data as MemoryStats;
}
