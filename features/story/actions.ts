"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { parseGuidance } from "./curate";

/** Salva as orientações da família e já as transforma em regras (excluir/priorizar). */
export async function saveStoryGuidance(formData: FormData) {
  const viewer = await requireAdmin();
  const V = viewer.vault.id;
  const guidance = String(formData.get("guidance") ?? "").trim().slice(0, 2000);
  const aiEnabled = formData.get("ai_enabled") === "on";
  const supabase = await createClient();
  const { error: vaultError } = await supabase.from("vaults").update({ ai_enabled: aiEnabled }).eq("id", V);
  if (vaultError) redirect(`/admin/historia?erro=${encodeURIComponent(friendlyError(vaultError))}`);
  const { data: people } = await supabase.from("people").select("id, display_name, relationship_type").eq("vault_id", V).neq("status", "archived");
  const rules = aiEnabled
    ? await parseGuidance(guidance, (people ?? []).map((p) => ({ id: p.id, name: p.display_name, relationship: p.relationship_type })))
    : { exclude: [], prioritize: [], notes: "" };
  const { error } = await supabase
    .from("story_settings")
    .upsert({ vault_id: V, guidance: guidance || null, rules, updated_by: viewer.profileId });
  if (error) redirect(`/admin/historia?erro=${encodeURIComponent(friendlyError(error))}`);
  // Força nova seleção com as regras novas
  await supabase.from("story_selections").delete().eq("vault_id", V);
  revalidatePath("/admin/historia");
  redirect("/admin/historia?salvo=1");
}
