"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/permissions/viewer";
import { getSettings } from "@/features/settings/queries";
import { commentSchema, createMemorySchema, type CreateMemoryInput } from "@/lib/validation/schemas";
import { checkFileAgainstLimits, MIME_EXTENSION, type MediaKind } from "@/lib/storage/limits";
import { signatureMatchesDeclared } from "@/lib/storage/signature";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { purgeMemoryFiles } from "./purge";
import { POLICY_VERSION } from "@/lib/constants";

const CONTRIBUTION_PURPOSE =
  "Guardar e exibir minhas contribuições na plataforma Maya Memories, conforme as regras de visibilidade e após revisão dos pais (aceito ao enviar).";

const BUCKET = "memories";

export type UploadTicket = { assetId: string; path: string; token: string; signedUrl: string; fileIndex: number };
export type DraftResult = { memoryId: string; uploads: UploadTicket[]; submitted: boolean };

async function contributorOrError() {
  const viewer = await getViewer();
  if (!viewer?.canContribute || !viewer.profileId || !viewer.vault) {
    return { viewer: null, error: viewer?.vault?.status === "read_only" ? "Este baú está em modo só leitura." : "Você não tem permissão para contribuir." };
  }
  if (!viewer.hasConsent && !viewer.isAdmin) {
    // Consentimento pelo ato de enviar: o termo é exibido junto ao botão.
    const supabase = await createClient();
    const { error } = await supabase.from("consents").insert({
      vault_id: viewer.vault!.id,
      person_id: viewer.personId!,
      consent_type: "contribution_terms",
      purpose: CONTRIBUTION_PURPOSE,
      status: "granted",
      policy_version: POLICY_VERSION,
    });
    if (error) return { viewer: null, error: friendlyError(error) };
    viewer.hasConsent = true;
  }
  return { viewer, error: null };
}

function resolveMemoryType(kind: string, kinds: MediaKind[]): string {
  if (kind === "photo") {
    if (kinds.length === 1) return kinds[0] === "video" ? "video" : "photo";
    if (kinds.every((k) => k === "image")) return "album";
    return "mixed";
  }
  return kind; // audio, text, letter, visit, drawing
}

/**
 * Cria a memória (rascunho) e registra cada arquivo esperado. Devolve URLs
 * de upload temporárias para envio DIRETO ao bucket privado.
 */
export async function createMemoryDraft(raw: CreateMemoryInput): Promise<ActionResult<DraftResult>> {
  const { viewer, error: authError } = await contributorOrError();
  if (!viewer) return { ok: false, error: authError! };

  const parsed = createMemorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const input = parsed.data;

  const settings = await getSettings();
  const limits = settings.limits;
  if (input.files.length > limits.max_files_per_memory) {
    return { ok: false, error: `Envie no máximo ${limits.max_files_per_memory} arquivos por memória.` };
  }
  const checked = input.files.map((f) => checkFileAgainstLimits(f, limits, { preferDocument: input.kind === "drawing" }));
  const failed = checked.find((c) => !c.ok);
  if (failed && !failed.ok) return { ok: false, error: failed.error };
  const files = checked.map((c, i) => ({ ...(c as Extract<typeof c, { ok: true }>), file: input.files[i] }));

  if (input.kind === "audio" && files.some((f) => f.kind !== "audio")) {
    return { ok: false, error: "Escolha um arquivo de áudio." };
  }

  const supabase = await createClient();

  // Cota por participante
  if (files.length) {
    const { data: used } = await supabase
      .from("media_assets")
      .select("size_bytes, memories!inner(created_by_profile_id)")
      .eq("memories.created_by_profile_id", viewer.profileId!)
      .eq("vault_id", viewer.vault!.id)
      .neq("processing_status", "deleted");
    const total = (used ?? []).reduce((acc, r) => acc + (r.size_bytes ?? 0), 0) + files.reduce((a, f) => a + f.file.size, 0);
    if (total > limits.max_bytes_per_person) {
      return { ok: false, error: "Você atingiu o espaço disponível para envios. Fale com os pais da Maya." };
    }
  }

  const memoryId = crypto.randomUUID();
  const memoryType = resolveMemoryType(input.kind, files.map((f) => f.kind));
  const { error: memError } = await supabase.from("memories").insert({
    id: memoryId,
    vault_id: viewer.vault!.id,
    memory_type: memoryType,
    title: input.title ?? (input.kind === "visit" ? "Visita" : null),
    description: input.description,
    occurred_at: input.visit?.occurredAt ?? input.occurredAt ?? null,
    visibility: input.visibility,
    recipient: input.kind === "letter" ? (input.recipient ?? "Maya") : null,
    unlock_at: input.kind === "letter" && input.unlockAt ? `${input.unlockAt}T09:00:00-03:00` : null,
    requested_capsule_id: input.requestedCapsuleId ?? null,
    ...(input.eventId ? { event_id: input.eventId } : {}),
    author_person_id: viewer.personId!,
    created_by_profile_id: viewer.profileId!,
    moderation_status: files.length ? "uploading" : "draft",
  });
  if (memError) return { ok: false, error: friendlyError(memError) };

  const cleanup = async () => {
    await createAdminClient().from("memories").delete().eq("id", memoryId);
  };

  if (input.kind === "visit" && input.visit) {
    const { error } = await supabase.from("visits").insert({
      vault_id: viewer.vault!.id,
      person_id: viewer.personId!,
      occurred_at: input.visit.occurredAt,
      visit_type: input.visit.visitType,
      companions: input.visit.companions,
      message: input.description,
      memory_id: memoryId,
      created_by: viewer.profileId!,
    });
    if (error) {
      await cleanup();
      return { ok: false, error: friendlyError(error) };
    }
  }

  const uploads: UploadTicket[] = [];
  for (const [i, f] of files.entries()) {
    const assetId = crypto.randomUUID();
    const path = `${viewer.vault!.id}/${memoryId}/${assetId}.${MIME_EXTENSION[f.mime] ?? "bin"}`;
    const { error } = await supabase.from("media_assets").insert({
      id: assetId,
      memory_id: memoryId,
      media_type: f.kind,
      storage_path: path,
      original_filename: f.file.name.slice(0, 255),
      mime_type: f.mime,
      size_bytes: f.file.size,
      duration_seconds: f.file.durationSeconds ?? null,
      position: i,
      created_by_profile_id: viewer.profileId!,
    });
    if (error) {
      await cleanup();
      return { ok: false, error: friendlyError(error) };
    }
    const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (signError || !signed) {
      await cleanup();
      return { ok: false, error: friendlyError(signError) };
    }
    uploads.push({ assetId, path, token: signed.token, signedUrl: signed.signedUrl, fileIndex: i });
  }

  if (!uploads.length) {
    const { error } = await supabase.rpc("submit_memory", { p_memory_id: memoryId });
    if (error) {
      await cleanup();
      return { ok: false, error: friendlyError(error) };
    }
    revalidatePath("/minhas-memorias");
    return { ok: true, data: { memoryId, uploads, submitted: true } };
  }
  return { ok: true, data: { memoryId, uploads, submitted: false } };
}

/** Nova URL de upload para tentar de novo após falha de rede. */
export async function renewUploadUrl(assetId: string): Promise<ActionResult<{ signedUrl: string }>> {
  const { viewer, error: authError } = await contributorOrError();
  if (!viewer) return { ok: false, error: authError! };
  const supabase = await createClient();
  const { data: asset } = await supabase
    .from("media_assets")
    .select("storage_path, processing_status, created_by_profile_id")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset || asset.created_by_profile_id !== viewer.profileId || asset.processing_status !== "pending_upload") {
    return { ok: false, error: "Arquivo não encontrado." };
  }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(asset.storage_path);
  if (error || !data) return { ok: false, error: friendlyError(error) };
  return { ok: true, data: { signedUrl: data.signedUrl } };
}

/**
 * Verifica o arquivo recebido: existência, tamanho real e assinatura dos
 * primeiros bytes. Só então o backend o marca como pronto.
 */
export async function finalizeAsset(assetId: string): Promise<ActionResult<{ status: string }>> {
  const { viewer, error: authError } = await contributorOrError();
  if (!viewer) return { ok: false, error: authError! };
  const supabase = await createClient();
  const { data: asset } = await supabase
    .from("media_assets")
    .select("id, storage_path, mime_type, media_type, processing_status, created_by_profile_id")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset || asset.created_by_profile_id !== viewer.profileId) return { ok: false, error: "Arquivo não encontrado." };
  if (asset.processing_status === "ready") return { ok: true, data: { status: "ready" } };

  const admin = createAdminClient();
  const fail = async (reason: string) => {
    await admin.storage.from(BUCKET).remove([asset.storage_path]);
    await admin.from("media_assets").update({ processing_status: "failed", failure_reason: reason }).eq("id", asset.id);
    return { ok: false as const, error: reason };
  };

  const cut = asset.storage_path.lastIndexOf("/");
  const folder = asset.storage_path.slice(0, cut);
  const filename = asset.storage_path.slice(cut + 1);
  const { data: listing } = await admin.storage.from(BUCKET).list(folder, { search: filename, limit: 1 });
  const object = listing?.find((o) => o.name === filename);
  if (!object) return { ok: false, error: "O arquivo ainda não chegou. Tente novamente." };
  const size = Number((object.metadata as { size?: number } | null)?.size ?? 0);

  const settings = await getSettings();
  const limit = settings.limits[asset.media_type as MediaKind];
  if (!size || size > limit.max_bytes) return fail("O arquivo excede o tamanho permitido.");

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(asset.storage_path, 60);
  if (!signed) return { ok: false, error: "Não foi possível verificar o arquivo agora." };
  const head = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-63" }, cache: "no-store" });
  const bytes = new Uint8Array(await head.arrayBuffer()).slice(0, 64);
  if (!signatureMatchesDeclared(bytes, asset.mime_type)) {
    return fail("O conteúdo do arquivo não corresponde ao formato informado.");
  }

  // MVP: imagens, áudios e vídeos em formatos reproduzíveis no celular ficam
  // prontos após a verificação. Miniaturas/transcodificação: fila futura.
  await admin.from("media_assets").update({ processing_status: "ready", size_bytes: size, failure_reason: null }).eq("id", asset.id);
  return { ok: true, data: { status: "ready" } };
}

/** Arquivo com falha que a pessoa decidiu não enviar. */
export async function dropAsset(assetId: string): Promise<ActionResult> {
  const { viewer, error: authError } = await contributorOrError();
  if (!viewer) return { ok: false, error: authError! };
  const supabase = await createClient();
  const { data: asset } = await supabase
    .from("media_assets")
    .select("id, storage_path, created_by_profile_id, memories!inner(moderation_status)")
    .eq("id", assetId)
    .maybeSingle();
  const status = (asset?.memories as unknown as { moderation_status: string } | null)?.moderation_status;
  if (!asset || asset.created_by_profile_id !== viewer.profileId || !["draft", "uploading", "changes_requested"].includes(status ?? "")) {
    return { ok: false, error: "Arquivo não encontrado." };
  }
  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove([asset.storage_path]);
  await admin.from("media_assets").delete().eq("id", asset.id);
  return { ok: true, data: undefined };
}

export async function submitMemory(memoryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_memory", { p_memory_id: memoryId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/minhas-memorias");
  return { ok: true, data: undefined };
}

/** Desistiu antes de enviar: remove o rascunho e seus arquivos. */
export async function discardDraft(memoryId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer?.profileId) return { ok: false, error: "Sessão expirada." };
  const supabase = await createClient();
  const { data: memory } = await supabase
    .from("memories")
    .select("id, created_by_profile_id, moderation_status, media_assets(storage_path)")
    .eq("id", memoryId)
    .maybeSingle();
  if (!memory || memory.created_by_profile_id !== viewer.profileId || !["draft", "uploading"].includes(memory.moderation_status)) {
    return { ok: false, error: "Rascunho não encontrado." };
  }
  const admin = createAdminClient();
  const paths = (memory.media_assets ?? []).map((a: { storage_path: string }) => a.storage_path);
  if (paths.length) await admin.storage.from(BUCKET).remove(paths);
  await admin.from("memories").delete().eq("id", memoryId);
  return { ok: true, data: undefined };
}

export async function requestRemoval(formData: FormData) {
  const memoryId = String(formData.get("memoryId") ?? "");
  const reason = String(formData.get("reason") ?? "").slice(0, 2000) || null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_memory_removal", { p_memory_id: memoryId, p_reason: reason });
  if (error) redirect(`/minhas-memorias/${memoryId}?erro=${encodeURIComponent(friendlyError(error))}`);
  if (data === "removed") {
    await purgeMemoryFiles(memoryId);
    revalidatePath("/minhas-memorias");
    redirect("/minhas-memorias?removida=1");
  }
  redirect(`/minhas-memorias/${memoryId}?pedido=1`);
}

export async function updateOwnMemory(formData: FormData) {
  const memoryId = String(formData.get("memoryId") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 200) || null;
  const description = String(formData.get("description") ?? "").trim().slice(0, 20000) || null;
  const occurredAt = String(formData.get("occurredAt") ?? "") || null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("memories")
    .update({ title, description, occurred_at: occurredAt && /^\d{4}-\d{2}-\d{2}$/.test(occurredAt) ? occurredAt : null })
    .eq("id", memoryId);
  if (error) redirect(`/minhas-memorias/${memoryId}?erro=${encodeURIComponent(friendlyError(error))}`);
  const { data: m } = await supabase.from("memories").select("moderation_status").eq("id", memoryId).maybeSingle();
  if (m && ["draft", "changes_requested"].includes(m.moderation_status)) {
    await supabase.rpc("submit_memory", { p_memory_id: memoryId });
  }
  revalidatePath(`/minhas-memorias/${memoryId}`);
  redirect(`/minhas-memorias/${memoryId}?salvo=1`);
}

export type CommentState = { status: "idle" | "sent" | "error"; message?: string };

export async function addComment(_prev: CommentState, formData: FormData): Promise<CommentState> {
  const parsed = commentSchema.safeParse({ memoryId: formData.get("memoryId"), body: formData.get("body") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };
  const { viewer, error: authError } = await contributorOrError();
  if (!viewer) return { status: "error", message: authError! };
  const supabase = await createClient();
  const { error } = await supabase.from("memory_comments").insert({
    memory_id: parsed.data.memoryId,
    body: parsed.data.body,
    author_person_id: viewer.personId!,
    created_by_profile_id: viewer.profileId!,
  });
  if (error) return { status: "error", message: friendlyError(error) };
  return { status: "sent" };
}
