import "server-only";
import { createClient } from "@/lib/supabase/server";
import { normalizeLimits, type UploadLimits } from "@/lib/storage/limits";

export type AppSettings = {
  project_title: string;
  subject_name: string;
  expected_birth_date: string | null;
  birth_date: string | null;
  require_comment_moderation: boolean;
  public_landing_enabled: boolean;
  limits: UploadLimits;
};

export async function getSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("*").maybeSingle();
  return {
    project_title: data?.project_title ?? "Maya Memories",
    subject_name: data?.subject_name ?? "Maya",
    expected_birth_date: data?.expected_birth_date ?? null,
    birth_date: data?.birth_date ?? null,
    require_comment_moderation: data?.require_comment_moderation ?? true,
    public_landing_enabled: data?.public_landing_enabled ?? true,
    limits: normalizeLimits(data?.upload_limits),
  };
}
