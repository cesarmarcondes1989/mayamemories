import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/features/settings/queries";
import { dateAtAge } from "@/lib/permissions/capsules";
import { todayISO } from "@/lib/format";

export async function getComposerData() {
  const settings = await getSettings();
  const supabase = await createClient();
  const { data: capsules } = await supabase
    .from("capsules")
    .select("id, title, status")
    .eq("vault_id", settings.vault_id ?? "")
    .in("status", ["scheduled", "sealed"])
    .order("opens_at", { ascending: true, nullsFirst: false });
  const today = todayISO();
  const birth = settings.kind === "child" ? (settings.birth_date ?? settings.expected_birth_date) : null;
  const letterMilestones = birth
    ? [1, 5, 10, 15, 18]
        .map((y) => ({ label: `Quando ${settings.subject_name} fizer ${y} ${y === 1 ? "ano" : "anos"}`, date: dateAtAge(birth, y) }))
        .filter((m) => m.date > today)
    : [];
  return { limits: settings.limits, today, letterMilestones, capsules: (capsules ?? []).map(({ id, title }) => ({ id, title })) };
}
