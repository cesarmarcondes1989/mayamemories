"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/permissions/viewer";
import { capsuleSchema, invitationSchema, personSchema } from "@/lib/validation/schemas";
import { friendlyError } from "@/lib/errors";
import { publicEnv } from "@/lib/env";
import { purgeMemoryFiles } from "@/features/memories/purge";
import { normalizeLimits } from "@/lib/storage/limits";

// Toda ação administrativa: (1) confere o papel no servidor, (2) executa com
// o cliente do usuário — o banco confere de novo (RLS / RPC com is_admin()).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(formData: FormData, key = "id"): string {
  const v = String(formData.get(key) ?? "");
  if (!UUID.test(v)) throw new Error("invalid id");
  return v;
}
function back(formData: FormData, fallback: string) {
  const to = String(formData.get("returnTo") ?? "");
  return to.startsWith("/admin") && !to.startsWith("//") ? to : fallback;
}
function fail(path: string, error: unknown): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}erro=${encodeURIComponent(friendlyError(error))}`);
}

// ---------------------------------------------------------------- moderação
export async function moderateMemory(formData: FormData) {
  await requireAdmin();
  const action = String(formData.get("action"));
  const note = String(formData.get("note") ?? "").trim() || null;
  const memoryId = id(formData);
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_memory", { p_memory_id: memoryId, p_action: action, p_note: note });
  const to = back(formData, "/admin/aprovacao");
  if (error) fail(to, error);
  if (action === "remove") await purgeMemoryFiles(memoryId);
  revalidatePath("/admin", "layout");
  redirect(to);
}

export async function bulkApprove(formData: FormData) {
  await requireAdmin();
  const ids = formData.getAll("ids").map(String).filter((v) => UUID.test(v));
  const supabase = await createClient();
  let failed = 0;
  for (const memoryId of ids) {
    const { error } = await supabase.rpc("moderate_memory", { p_memory_id: memoryId, p_action: "approve", p_note: null });
    if (error) failed++;
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/aprovacao?aprovadas=${ids.length - failed}${failed ? `&falhas=${failed}` : ""}`);
}

export async function moderateComment(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_comment", { p_comment_id: id(formData), p_action: String(formData.get("action")) });
  const to = back(formData, "/admin/aprovacao?filtro=comentarios");
  if (error) fail(to, error);
  revalidatePath("/admin", "layout");
  redirect(to);
}

export async function resolveDeletion(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const accept = formData.get("accept") === "1";
  const { data: req } = await supabase.from("data_deletion_requests").select("memory_id").eq("id", id(formData)).maybeSingle();
  const { error } = await supabase.rpc("resolve_deletion_request", { p_request_id: id(formData), p_accept: accept });
  if (error) fail("/admin/aprovacao?filtro=exclusoes", error);
  if (accept && req?.memory_id) await purgeMemoryFiles(req.memory_id);
  revalidatePath("/admin", "layout");
  redirect("/admin/aprovacao?filtro=exclusoes");
}

// ------------------------------------------------------------- memórias
export async function updateMemoryAdmin(formData: FormData) {
  await requireAdmin();
  const memoryId = id(formData);
  const to = `/admin/memorias/${memoryId}`;
  const occurred = String(formData.get("occurredAt") ?? "");
  const unlock = String(formData.get("unlockAt") ?? "");
  const position = String(formData.get("timelinePosition") ?? "");
  const visibility = String(formData.get("visibility"));
  if (!["private", "family", "selected", "capsule"].includes(visibility)) fail(to, "invalid visibility");
  const supabase = await createClient();
  const { error } = await supabase
    .from("memories")
    .update({
      title: String(formData.get("title") ?? "").trim().slice(0, 200) || null,
      description: String(formData.get("description") ?? "").trim().slice(0, 20000) || null,
      occurred_at: /^\d{4}-\d{2}-\d{2}$/.test(occurred) ? occurred : null,
      unlock_at: /^\d{4}-\d{2}-\d{2}$/.test(unlock) ? `${unlock}T09:00:00-03:00` : null,
      visibility,
      is_highlight: formData.get("highlight") === "on",
      timeline_position: /^-?\d{1,6}$/.test(position) ? Number(position) : null,
    })
    .eq("id", memoryId);
  if (error) fail(to, error);
  revalidatePath(to);
  redirect(`${to}?salvo=1`);
}

export async function setMemoryCapsules(formData: FormData) {
  const viewer = await requireAdmin();
  const memoryId = id(formData);
  const wanted = new Set(formData.getAll("capsules").map(String).filter((v) => UUID.test(v)));
  const supabase = await createClient();
  const { data: current } = await supabase.from("capsule_items").select("capsule_id").eq("memory_id", memoryId);
  const have = new Set((current ?? []).map((c) => c.capsule_id));
  const toAdd = [...wanted].filter((c) => !have.has(c));
  const toRemove = [...have].filter((c) => !wanted.has(c));
  if (toAdd.length) {
    const { error } = await supabase
      .from("capsule_items")
      .insert(toAdd.map((capsule_id) => ({ capsule_id, memory_id: memoryId, added_by: viewer.profileId })));
    if (error) fail(`/admin/memorias/${memoryId}`, error);
  }
  if (toRemove.length) await supabase.from("capsule_items").delete().eq("memory_id", memoryId).in("capsule_id", toRemove);
  revalidatePath(`/admin/memorias/${memoryId}`);
  redirect(`/admin/memorias/${memoryId}?salvo=1`);
}

export async function grantAccess(formData: FormData) {
  const viewer = await requireAdmin();
  const resourceType = String(formData.get("resourceType"));
  const resourceId = id(formData, "resourceId");
  const personId = id(formData, "personId");
  const to = back(formData, "/admin");
  if (!["memory", "capsule"].includes(resourceType)) fail(to, "invalid");
  const supabase = await createClient();
  const { data: person } = await supabase.from("people").select("profile_id").eq("id", personId).maybeSingle();
  if (!person?.profile_id) fail(to, "Esta pessoa ainda não ativou a conta.");
  const { error } = await supabase.from("access_grants").insert({
    grantee_profile_id: person.profile_id,
    resource_type: resourceType,
    resource_id: resourceId,
    granted_by: viewer.profileId,
  });
  if (error) fail(to, error);
  revalidatePath(to);
  redirect(to);
}

export async function revokeAccess(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("access_grants").update({ revoked_at: new Date().toISOString() }).eq("id", id(formData));
  const to = back(formData, "/admin");
  revalidatePath(to);
  redirect(to);
}

// --------------------------------------------------------------- pessoas
export async function createPerson(formData: FormData) {
  const viewer = await requireAdmin();
  const parsed = personSchema.safeParse({
    displayName: formData.get("displayName"),
    relationshipType: formData.get("relationshipType"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) fail("/admin/pessoas/nova", parsed.error.issues[0]?.message);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .insert({
      display_name: parsed.data.displayName,
      relationship_type: parsed.data.relationshipType,
      notes: parsed.data.notes,
      created_by: viewer.profileId,
    })
    .select("id")
    .single();
  if (error) fail("/admin/pessoas/nova", error);
  redirect(`/admin/pessoas/${data.id}?criada=1`);
}

export async function updatePerson(formData: FormData) {
  await requireAdmin();
  const personId = id(formData);
  const parsed = personSchema.safeParse({
    displayName: formData.get("displayName"),
    relationshipType: formData.get("relationshipType"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) fail(`/admin/pessoas/${personId}`, parsed.error.issues[0]?.message);
  const supabase = await createClient();
  const { error } = await supabase
    .from("people")
    .update({ display_name: parsed.data.displayName, relationship_type: parsed.data.relationshipType, notes: parsed.data.notes })
    .eq("id", personId);
  if (error) fail(`/admin/pessoas/${personId}`, error);
  redirect(`/admin/pessoas/${personId}?salvo=1`);
}

export async function setPersonRole(formData: FormData) {
  await requireAdmin();
  const personId = id(formData);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", {
    p_person_id: personId,
    p_role: String(formData.get("role")),
    p_enabled: formData.get("enabled") === "1",
  });
  if (error) fail(`/admin/pessoas/${personId}`, error);
  redirect(`/admin/pessoas/${personId}?salvo=1`);
}

export async function setPersonStatus(formData: FormData) {
  await requireAdmin();
  const personId = id(formData);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_person_status", { p_person_id: personId, p_status: String(formData.get("status")) });
  if (error) fail(`/admin/pessoas/${personId}`, error);
  redirect(`/admin/pessoas/${personId}?salvo=1`);
}

export async function setFamilyMembership(formData: FormData) {
  const viewer = await requireAdmin();
  const personId = id(formData);
  const supabase = await createClient();
  const { data: family } = await supabase.from("access_groups").select("id").eq("is_default_family", true).single();
  if (formData.get("enabled") === "1") {
    await supabase.from("access_group_members").upsert({ group_id: family!.id, person_id: personId, added_by: viewer.profileId });
  } else {
    await supabase.from("access_group_members").delete().eq("group_id", family!.id).eq("person_id", personId);
  }
  redirect(`/admin/pessoas/${personId}?salvo=1`);
}

// --------------------------------------------------------------- convites
export type InviteResult = { status: "idle" | "created" | "error"; link?: string; emailed?: boolean; message?: string };

export async function createInvitation(_prev: InviteResult, formData: FormData): Promise<InviteResult> {
  await requireAdmin();
  const parsed = invitationSchema.safeParse({
    personId: formData.get("personId"),
    email: formData.get("email") ?? "",
    expiresInDays: formData.get("expiresInDays") ?? 30,
    addToFamily: formData.get("addToFamily") === "on",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };
  const email = parsed.data.email || null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_invitation", {
    p_person_id: parsed.data.personId,
    p_email: email,
    p_expires_in_days: parsed.data.expiresInDays,
    p_add_to_family: parsed.data.addToFamily,
  });
  if (error || !data?.[0]) return { status: "error", message: friendlyError(error) };
  const { invitation_id, secret } = data[0] as { invitation_id: string; secret: string };
  const link = `${publicEnv.siteUrl()}/convite/${secret}`;

  // Link nominal por e-mail: a posse do e-mail é a prova; o segredo não viaja.
  let emailed = false;
  if (email && formData.get("sendEmail") === "on") emailed = await sendInviteEmail(email, invitation_id);

  if (formData.get("nfc") === "on") {
    await supabase.rpc("admin_create_nfc_token", {
      p_person_id: parsed.data.personId,
      p_label: String(formData.get("nfcLabel") ?? "") || null,
      p_invitation_id: invitation_id,
      p_activate: true,
    });
  }
  revalidatePath("/admin/convites");
  return { status: "created", link, emailed };
}

async function sendInviteEmail(email: string, invitationId: string): Promise<boolean> {
  const admin = createAdminClient();
  const redirectTo = `${publicEnv.siteUrl()}/convite/concluir`;
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  let ok = !error;
  if (error && /already|registered|exists/i.test(error.message)) {
    // Conta já existe: envia link mágico comum (concluir aceitará pelo e-mail)
    const { error: otpError } = await admin.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
    ok = !otpError;
  }
  if (ok) {
    const supabase = await createClient();
    await supabase.from("invitations").update({ last_sent_at: new Date().toISOString() }).eq("id", invitationId);
  }
  return ok;
}

export async function resendInvitation(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invitations").select("id, email").eq("id", id(formData)).maybeSingle();
  if (!inv?.email) fail("/admin/convites", "Este convite não tem e-mail. Crie um novo link.");
  const ok = await sendInviteEmail(inv.email, inv.id);
  redirect(ok ? "/admin/convites?reenviado=1" : "/admin/convites?erro=Falha%20ao%20enviar");
}

export async function revokeInvitation(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id(formData)).is("accepted_at", null);
  revalidatePath("/admin/convites");
  redirect(back(formData, "/admin/convites"));
}

// -------------------------------------------------------------------- NFC
export async function createNfcToken(formData: FormData) {
  await requireAdmin();
  const personId = String(formData.get("personId") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_nfc_token", {
    p_person_id: UUID.test(personId) ? personId : null,
    p_label: String(formData.get("label") ?? "").slice(0, 120) || null,
    p_invitation_id: null,
    p_activate: formData.get("activate") === "on",
  });
  if (error) fail("/admin/tokens", error);
  revalidatePath("/admin/tokens");
  redirect("/admin/tokens?criado=1");
}

export async function setNfcStatus(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_nfc_status", { p_token_id: id(formData), p_status: String(formData.get("status")) });
  if (error) fail("/admin/tokens", error);
  revalidatePath("/admin/tokens");
  redirect(back(formData, "/admin/tokens"));
}

export async function replaceNfcToken(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_replace_nfc_token", { p_token_id: id(formData) });
  if (error) fail("/admin/tokens", error);
  revalidatePath("/admin/tokens");
  redirect("/admin/tokens?substituido=1");
}

export async function updateNfcNotes(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase
    .from("nfc_tokens")
    .update({ label: String(formData.get("label") ?? "").slice(0, 120) || null, notes: String(formData.get("notes") ?? "").slice(0, 1000) || null })
    .eq("id", id(formData));
  redirect("/admin/tokens");
}

// ---------------------------------------------------------------- cápsulas
function readCapsule(formData: FormData) {
  return capsuleSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    theme: formData.get("theme") ?? undefined,
    capsuleType: formData.get("capsuleType"),
    openingRule: formData.get("openingRule"),
    opensAt: (formData.get("opensAt") as string) || null,
    visibilityPolicy: formData.get("visibilityPolicy"),
  });
}

export async function createCapsule(formData: FormData) {
  const viewer = await requireAdmin();
  const parsed = readCapsule(formData);
  if (!parsed.success) fail("/admin/capsulas/nova", parsed.error.issues[0]?.message);
  const c = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("capsules")
    .insert({
      title: c.title,
      description: c.description,
      theme: c.theme,
      capsule_type: c.capsuleType,
      opening_rule: c.openingRule,
      opens_at: c.opensAt ? `${c.opensAt}T09:00:00-03:00` : null,
      visibility_policy: c.visibilityPolicy,
      status: "draft",
      created_by: viewer.profileId,
    })
    .select("id")
    .single();
  if (error) fail("/admin/capsulas/nova", error);
  redirect(`/admin/capsulas/${data.id}`);
}

export async function updateCapsule(formData: FormData) {
  await requireAdmin();
  const capsuleId = id(formData);
  const parsed = readCapsule(formData);
  if (!parsed.success) fail(`/admin/capsulas/${capsuleId}`, parsed.error.issues[0]?.message);
  const c = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("capsules")
    .update({
      title: c.title,
      description: c.description,
      theme: c.theme,
      capsule_type: c.capsuleType,
      opening_rule: c.openingRule,
      opens_at: c.opensAt ? `${c.opensAt}T09:00:00-03:00` : null,
      visibility_policy: c.visibilityPolicy,
    })
    .eq("id", capsuleId);
  if (error) fail(`/admin/capsulas/${capsuleId}`, error);
  redirect(`/admin/capsulas/${capsuleId}?salvo=1`);
}

export async function setCapsuleStatus(formData: FormData) {
  await requireAdmin();
  const capsuleId = id(formData);
  const supabase = await createClient();
  const status = String(formData.get("status"));
  const { error } =
    status === "open"
      ? await supabase.rpc("admin_open_capsule", { p_capsule_id: capsuleId })
      : await supabase.rpc("admin_set_capsule_status", { p_capsule_id: capsuleId, p_status: status });
  if (error) fail(`/admin/capsulas/${capsuleId}`, error);
  revalidatePath("/admin/capsulas");
  redirect(`/admin/capsulas/${capsuleId}?salvo=1`);
}

export async function removeCapsuleItem(formData: FormData) {
  await requireAdmin();
  const capsuleId = id(formData, "capsuleId");
  const supabase = await createClient();
  await supabase.from("capsule_items").delete().eq("capsule_id", capsuleId).eq("memory_id", id(formData, "memoryId"));
  redirect(`/admin/capsulas/${capsuleId}`);
}

export async function addCapsuleItems(formData: FormData) {
  const viewer = await requireAdmin();
  const capsuleId = id(formData, "capsuleId");
  const ids = formData.getAll("memoryIds").map(String).filter((v) => UUID.test(v));
  const supabase = await createClient();
  if (ids.length) {
    await supabase
      .from("capsule_items")
      .upsert(ids.map((memory_id) => ({ capsule_id: capsuleId, memory_id, added_by: viewer.profileId })), {
        onConflict: "capsule_id,memory_id",
        ignoreDuplicates: true,
      });
  }
  redirect(`/admin/capsulas/${capsuleId}?salvo=1`);
}

export async function generateGrowthCapsules() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_generate_growth_capsules");
  if (error) fail("/admin/capsulas", error);
  redirect(`/admin/capsulas?geradas=${data ?? 0}`);
}

// ----------------------------------------------------------- configurações
export async function updateSettings(formData: FormData) {
  await requireAdmin();
  const date = (k: string) => {
    const v = String(formData.get(k) ?? "");
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  };
  const mb = (k: string, fallback: number) => {
    const n = Number(formData.get(k));
    return Number.isFinite(n) && n > 0 && n <= 5000 ? Math.round(n * 1024 * 1024) : fallback;
  };
  const supabase = await createClient();
  const { data: current } = await supabase.from("app_settings").select("upload_limits").single();
  const limits = normalizeLimits(current?.upload_limits);
  limits.image.max_bytes = mb("imageMb", limits.image.max_bytes);
  limits.video.max_bytes = mb("videoMb", limits.video.max_bytes);
  limits.audio.max_bytes = mb("audioMb", limits.audio.max_bytes);
  limits.document.max_bytes = mb("documentMb", limits.document.max_bytes);
  const minutes = (k: string, fallback?: number) => {
    const n = Number(formData.get(k));
    return Number.isFinite(n) && n > 0 && n <= 240 ? Math.round(n * 60) : fallback;
  };
  limits.video.max_seconds = minutes("videoMin", limits.video.max_seconds);
  limits.audio.max_seconds = minutes("audioMin", limits.audio.max_seconds);
  const files = Number(formData.get("maxFiles"));
  if (Number.isInteger(files) && files >= 1 && files <= 50) limits.max_files_per_memory = files;
  const quota = Number(formData.get("quotaGb"));
  if (Number.isFinite(quota) && quota > 0 && quota <= 1000) limits.max_bytes_per_person = Math.round(quota * 1024 ** 3);

  const { error } = await supabase
    .from("app_settings")
    .update({
      project_title: String(formData.get("projectTitle") ?? "").trim().slice(0, 120) || "Maya Memories",
      subject_name: String(formData.get("subjectName") ?? "").trim().slice(0, 60) || "Maya",
      expected_birth_date: date("expectedBirthDate"),
      birth_date: date("birthDate"),
      require_comment_moderation: true, // MVP: moderação de comentários é obrigatória
      upload_limits: limits,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) fail("/admin/configuracoes", error);
  redirect("/admin/configuracoes?salvo=1");
}

export async function addRelationshipType(formData: FormData) {
  await requireAdmin();
  const label = String(formData.get("label") ?? "").trim().slice(0, 60);
  const key = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  if (key.length < 2) fail("/admin/configuracoes", "Nome inválido");
  const supabase = await createClient();
  const { error } = await supabase.from("relationship_types").insert({ key, label, sort_order: 80 });
  if (error) fail("/admin/configuracoes", error);
  redirect("/admin/configuracoes?salvo=1");
}
