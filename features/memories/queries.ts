import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signMediaPaths } from "@/lib/storage/media";

export type MediaAsset = {
  id: string;
  media_type: string;
  storage_path: string;
  mime_type: string;
  processing_status: string;
  position: number;
  original_filename?: string | null;
  url?: string;
};

export type MemoryRow = {
  id: string;
  title: string | null;
  description: string | null;
  memory_type: string;
  occurred_at: string | null;
  created_at: string;
  submitted_at: string | null;
  visibility: string;
  moderation_status: string;
  moderation_note: string | null;
  is_highlight: boolean;
  unlock_at: string | null;
  recipient: string | null;
  timeline_position: number | null;
  created_by_profile_id: string;
  author: { id: string; display_name: string } | null;
  media_assets: MediaAsset[];
  capsule_items: Array<{ capsule_id: string }>;
};

export const MEMORY_SELECT = `
  id, title, description, memory_type, occurred_at, created_at, submitted_at, visibility, moderation_status,
  moderation_note, is_highlight, unlock_at, recipient, timeline_position, created_by_profile_id,
  author:people!memories_author_person_id_fkey(id, display_name),
  media_assets(id, media_type, storage_path, mime_type, processing_status, position, original_filename),
  capsule_items(capsule_id)
`;

export async function attachMediaUrls(memories: MemoryRow[], opts: { firstOnly?: boolean } = {}): Promise<MemoryRow[]> {
  const supabase = await createClient();
  for (const m of memories) {
    m.media_assets = (m.media_assets ?? [])
      .filter((a) => a.processing_status === "ready")
      .sort((a, b) => a.position - b.position);
  }
  const paths = memories.flatMap((m) => (opts.firstOnly ? m.media_assets.slice(0, 1) : m.media_assets).map((a) => a.storage_path));
  const urls = await signMediaPaths(supabase, paths);
  for (const m of memories) for (const a of m.media_assets) a.url = urls[a.storage_path];
  return memories;
}

export type TimelineFilters = { year?: string; type?: string; person?: string; capsule?: string; highlight?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listTimeline(raw: TimelineFilters, opts: { includeCapsuleOnly?: boolean } = {}) {
  const filters: TimelineFilters = {
    ...raw,
    person: raw.person && UUID.test(raw.person) ? raw.person : undefined,
    capsule: raw.capsule && UUID.test(raw.capsule) ? raw.capsule : undefined,
    type: raw.type && /^[a-z_]{2,20}$/.test(raw.type) ? raw.type : undefined,
  };
  const supabase = await createClient();
  const select: string = filters.capsule
    ? MEMORY_SELECT.replace("capsule_items(capsule_id)", "capsule_items!inner(capsule_id)")
    : MEMORY_SELECT;
  let query = supabase
    .from("memories")
    .select(select)
    .eq("moderation_status", "approved")
    .is("deleted_at", null);
  if (filters.capsule) query = query.eq("capsule_items.capsule_id", filters.capsule);
  else if (!opts.includeCapsuleOnly) query = query.neq("visibility", "capsule");
  if (filters.type) query = query.eq("memory_type", filters.type);
  if (filters.person) query = query.eq("author_person_id", filters.person);
  if (filters.highlight === "1") query = query.eq("is_highlight", true);
  if (filters.year && /^\d{4}$/.test(filters.year)) {
    query = query.gte("occurred_at", `${filters.year}-01-01`).lte("occurred_at", `${filters.year}-12-31`);
  }
  const { data, error } = await query
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .order("timeline_position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return attachMediaUrls((data ?? []) as unknown as MemoryRow[], { firstOnly: true });
}

export async function getMemory(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("memories").select(MEMORY_SELECT).eq("id", id).maybeSingle();
  if (!data) return null;
  const [memory] = await attachMediaUrls([data as unknown as MemoryRow]);
  return memory;
}

export async function listComments(memoryId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memory_comments")
    .select("id, body, status, created_at, created_by_profile_id, author:people!memory_comments_author_person_id_fkey(display_name)")
    .eq("memory_id", memoryId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as Array<{
    id: string;
    body: string;
    status: string;
    created_at: string;
    created_by_profile_id: string;
    author: { display_name: string } | null;
  }>;
}
