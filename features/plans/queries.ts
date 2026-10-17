import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { DEFAULT_BRAND, DEFAULT_PLANS, type Brand, type Plan } from "@/lib/plans";

const COLUMNS =
  "key, name, tagline, audience, billing, price_monthly_cents, price_yearly_cents, price_once_cents, features, highlight, sort_order, active";

function normalize(row: Record<string, unknown>): Plan {
  return { ...(row as Plan), features: Array.isArray(row.features) ? row.features.map(String) : [] };
}

/** Planos ativos para a vitrine. Se o banco não responder, usa os padrões. */
export async function getPublicPlans(): Promise<Plan[]> {
  if (!isSupabaseConfigured()) return DEFAULT_PLANS;
  const supabase = await createClient();
  const { data, error } = await supabase.from("plans").select(COLUMNS).eq("active", true).order("sort_order");
  if (error || !data?.length) return DEFAULT_PLANS;
  return data.map(normalize);
}

/** Todos os planos (inclusive inativos) — só o dono da plataforma enxerga. */
export async function getAllPlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("plans").select(COLUMNS).order("sort_order");
  if (error) throw new Error(error.message);
  return data.map(normalize);
}

export async function getBrand(): Promise<Brand> {
  if (!isSupabaseConfigured()) return DEFAULT_BRAND;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_brand");
  if (error || !data) return DEFAULT_BRAND;
  return { ...DEFAULT_BRAND, ...(data as Partial<Brand>) };
}

export type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  kind: "child" | "event" | null;
  plan_key: string | null;
  message: string | null;
  source: string | null;
  status: "new" | "contacted" | "converted" | "lost";
  notes: string | null;
  persona?: string | null;
  age_range?: string | null;
  created_at: string;
};

export async function getLeads(status?: string): Promise<Lead[]> {
  const supabase = await createClient();
  let q = supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(300);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as Lead[];
}
