"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/permissions/viewer";
import { friendlyError } from "@/lib/errors";
import { parsePriceToCents } from "@/lib/plans";

// ------------------------------------------------------------ vitrine (público)
export type LeadState = { ok: boolean; error?: string; fields?: Record<string, string> };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function parseUtm(raw: string): Record<string, string> {
  try {
    const obj = JSON.parse(raw || "{}");
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

export async function submitLead(_prev: LeadState, formData: FormData): Promise<LeadState> {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  // Campo invisível: robôs preenchem, pessoas não.
  if (get("website")) return { ok: true };
  const fields = {
    name: get("name"), email: get("email"), phone: get("phone"), kind: get("kind"), plan: get("plan"), message: get("message"),
    persona: get("persona"), age_range: get("age_range"),
  };
  if (!fields.name) return { ok: false, error: "Como podemos te chamar?", fields };
  if (!fields.email && !fields.phone) return { ok: false, error: "Deixe um e-mail ou WhatsApp para a gente responder.", fields };
  if (fields.email && !EMAIL.test(fields.email)) return { ok: false, error: "Esse e-mail parece incompleto.", fields };
  const digits = fields.phone.replace(/\D/g, "");
  const phone = digits && digits.length <= 11 ? `55${digits}` : digits;
  if (phone && (phone.length < 10 || phone.length > 15)) return { ok: false, error: "Confira o WhatsApp com DDD.", fields };

  const referer = (await headers()).get("referer") ?? "";
  let source = "site";
  try {
    const u = new URL(referer);
    source = u.searchParams.get("utm_source") || u.searchParams.get("ref") || parseUtm(get("utm")).utm_source || "site";
  } catch {}

  const supabase = await createClient();
  const base = {
    p_name: fields.name.slice(0, 120),
    p_email: fields.email || null,
    p_phone: phone || null,
    p_kind: fields.kind || null,
    p_plan_key: fields.plan || null,
    p_message: fields.message.slice(0, 1000) || null,
    p_source: source.slice(0, 120),
  };
  let { error } = await supabase.rpc("submit_lead", {
    ...base,
    p_age_range: fields.age_range || null,
    p_persona: fields.persona || null,
    p_utm: parseUtm(get("utm")),
    p_visitor_id: /^[0-9a-f-]{36}$/i.test(get("vid")) ? get("vid") : null,
  });
  // Banco ainda sem a migration 012: grava o essencial
  if (error?.code === "PGRST202") ({ error } = await supabase.rpc("submit_lead", base));
  if (error) return { ok: false, error: friendlyError(error, "Não conseguimos registrar agora. Tente de novo em instantes."), fields };
  return { ok: true };
}

// ------------------------------------------------- painel do dono da plataforma
function fail(path: string, error: unknown): never {
  redirect(`${path}?erro=${encodeURIComponent(friendlyError(error))}`);
}

export async function updatePlan(formData: FormData) {
  await requirePlatformAdmin();
  const key = String(formData.get("key") ?? "");
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const billing = get("billing");
  const features = get("features").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 20);
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({
      name: get("name").slice(0, 60),
      tagline: get("tagline").slice(0, 160) || null,
      billing: ["free", "subscription", "one_time"].includes(billing) ? billing : "subscription",
      price_monthly_cents: parsePriceToCents(get("price_monthly")),
      price_yearly_cents: parsePriceToCents(get("price_yearly")),
      price_once_cents: parsePriceToCents(get("price_once")),
      features,
      highlight: formData.get("highlight") === "on",
      active: formData.get("active") === "on",
      sort_order: Number.parseInt(get("sort_order"), 10) || 100,
    })
    .eq("key", key);
  if (error) fail("/plataforma/planos", error);
  revalidatePath("/", "layout");
  redirect(`/plataforma/planos?salvo=${encodeURIComponent(key)}`);
}

export async function updateLead(formData: FormData) {
  await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;
  if (!["new", "contacted", "converted", "lost"].includes(status)) fail("/plataforma", "invalid status");
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ status, notes }).eq("id", id);
  if (error) fail("/plataforma", error);
  revalidatePath("/plataforma");
  redirect("/plataforma?salvo=1");
}

export async function updateBrand(formData: FormData) {
  await requirePlatformAdmin();
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const whatsapp = get("contact_whatsapp").replace(/\D/g, "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({
      brand_name: get("brand_name").slice(0, 60) || "Baú de Memórias",
      brand_slogan: get("brand_slogan").slice(0, 160),
      contact_whatsapp: whatsapp ? (whatsapp.length <= 11 ? `55${whatsapp}` : whatsapp) : null,
      contact_email: get("contact_email") || null,
    })
    .eq("id", true);
  if (error) fail("/plataforma/marca", error);
  revalidatePath("/", "layout");
  redirect("/plataforma/marca?salvo=1");
}
