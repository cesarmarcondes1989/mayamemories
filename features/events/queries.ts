import "server-only";
import { createClient } from "@/lib/supabase/server";

export type VaultEvent = {
  id: string;
  name: string;
  event_date: string | null;
  description: string | null;
  status: "open" | "closed" | "archived";
};

/** Eventos que a pessoa enxerga (família: todos; convidado: o dele). RLS decide. */
export async function getVisibleEvents(vaultId: string, opts: { openOnly?: boolean } = {}): Promise<VaultEvent[]> {
  const supabase = await createClient();
  let q = supabase
    .from("vault_events")
    .select("id, name, event_date, description, status")
    .eq("vault_id", vaultId)
    .neq("status", "archived")
    .order("event_date", { ascending: false, nullsFirst: true });
  if (opts.openOnly) q = q.eq("status", "open");
  const { data } = await q;
  return (data ?? []) as VaultEvent[];
}
