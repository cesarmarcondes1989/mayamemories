import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { parseUserAgent, sanitizePath } from "@/lib/analytics/ua";

export const dynamic = "force-dynamic";

const EVENTS = new Set(["page_view", "plans_view", "plan_click", "cta_click", "lead_form_start", "lead_submit", "login_view", "nfc_open", "signup_start"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (v: unknown, max = 120) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const header = (req: NextRequest, name: string, max: number) => {
  const v = req.headers.get(name);
  if (!v) return null;
  try {
    return decodeURIComponent(v).slice(0, max);
  } catch {
    return v.slice(0, max);
  }
};

/**
 * Coletor da vitrine. Não guarda IP nem User-Agent inteiro: só aparelho,
 * navegador, sistema e região aproximada (cabeçalhos de geolocalização da Vercel).
 * Identificadores de visitante/sessão só chegam aqui se a pessoa aceitou cookies.
 */
export async function POST(request: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  if (!isSupabaseConfigured()) return done;
  const raw = await request.text();
  if (raw.length > 2000) return done;
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return done;
  }
  const event = String(body.e ?? "");
  if (!EVENTS.has(event)) return done;
  const ua = parseUserAgent(request.headers.get("user-agent"));
  if (ua.bot) return done; // robôs e prévias de link não contam

  let referrerHost: string | null = null;
  try {
    const ref = typeof body.ref === "string" && body.ref ? new URL(body.ref) : null;
    const own = new URL(publicEnv.siteUrl()).hostname;
    if (ref && ref.hostname !== own && ref.hostname !== request.nextUrl.hostname) referrerHost = ref.hostname.replace(/^www\./, "").slice(0, 120);
  } catch {}

  const utm = (body.utm && typeof body.utm === "object" ? body.utm : {}) as Record<string, unknown>;
  const authCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  const { error } = await createAdminClient().from("analytics_events").insert({
    event,
    path: sanitizePath(String(body.p ?? "/")),
    visitor_id: typeof body.vid === "string" && UUID.test(body.vid) ? body.vid : null,
    session_id: typeof body.sid === "string" && UUID.test(body.sid) ? body.sid : null,
    referrer_host: referrerHost,
    utm_source: str(utm.utm_source),
    utm_medium: str(utm.utm_medium),
    utm_campaign: str(utm.utm_campaign),
    utm_content: str(utm.utm_content),
    device: ua.device,
    browser: ua.browser,
    os: ua.os,
    country: header(request, "x-vercel-ip-country", 2),
    region: header(request, "x-vercel-ip-country-region", 60),
    city: header(request, "x-vercel-ip-city", 80),
    plan_key: str(body.plan, 30),
    logged_in: authCookie,
  });
  if (error) console.error("[analytics]", error.message);
  return done;
}
