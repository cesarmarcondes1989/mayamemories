"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/permissions/viewer";
import { friendlyError } from "@/lib/errors";

// Eventos do baú ("1 ano", "Chá bar"…). O banco confere o admin de novo.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(error: unknown): never {
  redirect(`/admin/eventos?erro=${encodeURIComponent(friendlyError(error))}`);
}
function eventId(formData: FormData): string {
  const v = String(formData.get("eventId") ?? "");
  if (!UUID.test(v)) fail("invalid id");
  return v;
}
function fields(formData: FormData) {
  const date = String(formData.get("eventDate") ?? "");
  return {
    name: String(formData.get("name") ?? "").trim().slice(0, 80),
    date: DATE.test(date) ? date : null,
    description: String(formData.get("description") ?? "").trim().slice(0, 1000) || null,
  };
}

export async function createEvent(formData: FormData) {
  const viewer = await requireAdmin();
  const f = fields(formData);
  if (!f.name) fail("Dê um nome ao evento.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_event", {
    p_vault_id: viewer.vault.id,
    p_name: f.name,
    p_event_date: f.date,
    p_description: f.description,
  });
  if (error) fail(error);
  // Já nasce com um token de mesa, pronto para gravar no NFC ou virar QR
  if (formData.get("tableToken") === "on") {
    await supabase.rpc("admin_create_nfc_token", {
      p_vault_id: viewer.vault.id,
      p_person_id: null,
      p_label: "Mesa",
      p_invitation_id: null,
      p_activate: true,
      p_event_id: (data as { id: string }).id,
    });
  }
  revalidatePath("/admin/eventos");
  redirect("/admin/eventos?criado=1");
}

export async function updateEvent(formData: FormData) {
  await requireAdmin();
  const f = fields(formData);
  if (!f.name) fail("Dê um nome ao evento.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("vault_events")
    .update({ name: f.name, event_date: f.date, description: f.description })
    .eq("id", eventId(formData));
  if (error) fail(error);
  revalidatePath("/admin/eventos");
  redirect("/admin/eventos?salvo=1");
}

export async function setEventStatus(formData: FormData) {
  await requireAdmin();
  const status = String(formData.get("status"));
  if (!["open", "closed", "archived"].includes(status)) fail("invalid status");
  const supabase = await createClient();
  const { error } = await supabase.from("vault_events").update({ status }).eq("id", eventId(formData));
  if (error) fail(error);
  revalidatePath("/admin/eventos");
  redirect("/admin/eventos?salvo=1");
}

export async function createTableToken(formData: FormData) {
  const viewer = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_nfc_token", {
    p_vault_id: viewer.vault.id,
    p_person_id: null,
    p_label: String(formData.get("label") ?? "").trim().slice(0, 120) || "Mesa",
    p_invitation_id: null,
    p_activate: true,
    p_event_id: eventId(formData),
  });
  if (error) fail(error);
  revalidatePath("/admin/eventos");
  revalidatePath("/admin/tokens");
  redirect("/admin/eventos?token=1");
}
