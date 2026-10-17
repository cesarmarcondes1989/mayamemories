import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/permissions/viewer";
import { normalizeLimits, type UploadLimits } from "@/lib/storage/limits";

export type VaultSettings = {
  vault_id: string | null;
  title: string;
  subject_name: string;
  expected_birth_date: string | null;
  birth_date: string | null;
  event_date: string | null;
  kind: "child" | "event";
  theme: string;
  welcome_message: string | null;
  nudges_enabled: boolean;
  limits: UploadLimits;
};

/** Configurações do baú em uso; limites = padrão da plataforma + ajustes do baú. */
export async function getSettings(): Promise<VaultSettings> {
  const supabase = await createClient();
  const [viewer, { data: platform }] = await Promise.all([
    getViewer(),
    supabase.from("app_settings").select("upload_limits").maybeSingle(),
  ]);
  const v = viewer?.vault;
  const base = normalizeLimits(platform?.upload_limits);
  const own = (v?.upload_limits ?? {}) as Partial<UploadLimits>;
  return {
    vault_id: v?.id ?? null,
    title: v?.title ?? "Guardei pra você",
    subject_name: v?.subject_name ?? "Maya",
    expected_birth_date: v?.expected_birth_date ?? null,
    birth_date: v?.birth_date ?? null,
    event_date: v?.event_date ?? null,
    kind: v?.kind ?? "child",
    theme: v?.theme ?? "rosa",
    welcome_message: v?.welcome_message ?? null,
    nudges_enabled: v?.nudges_enabled ?? true,
    limits: normalizeLimits({ ...base, ...own }),
  };
}
