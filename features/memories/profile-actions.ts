"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/permissions/viewer";

export async function updateProfile(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer?.profileId) redirect("/entrar");
  const name = String(formData.get("displayName") ?? "").trim().slice(0, 120);
  const supabase = await createClient();
  if (name) await supabase.from("profiles").update({ display_name: name }).eq("id", viewer.profileId);
  await supabase.from("notification_preferences").upsert({
    profile_id: viewer.profileId,
    on_contribution_reviewed: formData.get("reviewed") === "on",
    on_capsule_opening: formData.get("capsules") === "on",
    on_new_memories_digest: formData.get("digest") === "on",
    gentle_reminders: formData.get("reminders") === "on",
    updated_at: new Date().toISOString(),
  });
  revalidatePath("/perfil");
  redirect("/perfil?salvo=1");
}
