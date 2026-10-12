import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Monta o manifesto de exportação (independente do banco original).
 * Executa com o cliente do administrador: o RLS continua valendo.
 * Não inclui segredos (hashes de convite) nem e-mails de autenticação.
 */
export async function buildExportManifest(supabase: SupabaseClient) {
  const all = async (table: string, columns = "*") => {
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
      if (error) throw new Error(`${table}: ${error.message}`);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  };

  const [settings, people, relationshipTypes, visits, memories, media, comments, capsules, capsuleItems, consents, groups, groupMembers, grants] =
    await Promise.all([
      all("app_settings", "project_title, subject_name, expected_birth_date, birth_date"),
      all("people", "id, display_name, relationship_type, status, created_at"),
      all("relationship_types", "key, label"),
      all("visits", "id, person_id, occurred_at, registered_at, visit_type, message, companions, status, memory_id"),
      all("memories", "id, title, description, memory_type, author_person_id, occurred_at, visibility, moderation_status, unlock_at, recipient, is_highlight, published_at, created_at, updated_at, deleted_at"),
      all("media_assets", "id, memory_id, media_type, storage_path, original_filename, mime_type, size_bytes, duration_seconds, processing_status, position, created_at"),
      all("memory_comments", "id, memory_id, author_person_id, body, status, created_at"),
      all("capsules", "id, title, description, theme, capsule_type, opens_at, opening_rule, status, visibility_policy, opened_at, created_at"),
      all("capsule_items", "capsule_id, memory_id, position, created_at"),
      all("consents", "person_id, consent_type, purpose, status, policy_version, granted_at, withdrawn_at, created_at"),
      all("access_groups", "id, name, is_default_family"),
      all("access_group_members", "group_id, person_id, created_at"),
      all("access_grants", "resource_type, resource_id, permission, grantee_profile_id, grantee_group_id, expires_at, revoked_at, created_at"),
    ]);

  return {
    format: "maya-memories-export",
    version: 1,
    exported_at: new Date().toISOString(),
    readme:
      "Cada memória referencia seus arquivos em media[].storage_path. O script scripts/export-media.mjs baixa os arquivos para media/<storage_path>. Datas de acontecimento (occurred_at) são distintas das datas de registro (created_at).",
    settings: settings[0] ?? null,
    relationship_types: relationshipTypes,
    people,
    visits,
    memories,
    media: (media as Array<{ processing_status: string }>).filter((m) => m.processing_status !== "deleted"),
    comments,
    capsules,
    capsule_items: capsuleItems,
    consents,
    access: { groups, group_members: groupMembers, grants },
  };
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    // Evita injeção de fórmulas em planilhas
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}
