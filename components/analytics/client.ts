"use client";

// Analytics da vitrine, do lado do navegador. Sem consentimento: só contagens
// anônimas (sem identificador). Com consentimento: visitante + sessão, para
// medir o funil e a volta das pessoas.

export type TrackEvent = "page_view" | "plans_view" | "plan_click" | "cta_click" | "lead_form_start" | "lead_submit" | "login_view" | "nfc_open" | "signup_start";

const CONSENT_KEY = "mm_consent";
const VID_KEY = "mm_vid";
const SID_KEY = "mm_sid";
const UTM_KEY = "mm_utm";
const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function getConsent(): "yes" | "no" | null {
  return safe(() => (localStorage.getItem(CONSENT_KEY) as "yes" | "no" | null), null);
}

export function setConsent(value: "yes" | "no") {
  safe(() => {
    localStorage.setItem(CONSENT_KEY, value);
    if (value === "no") {
      localStorage.removeItem(VID_KEY);
      sessionStorage.removeItem(SID_KEY);
      sessionStorage.removeItem(UTM_KEY);
    }
  }, undefined);
}

function ensureId(storage: Storage, key: string): string {
  let id = storage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    storage.setItem(key, id);
  }
  return id;
}

export function getIds(): { vid?: string; sid?: string } {
  if (getConsent() !== "yes") return {};
  return safe<{ vid?: string; sid?: string }>(() => ({ vid: ensureId(localStorage, VID_KEY), sid: ensureId(sessionStorage, SID_KEY) }), {});
}

/** Campanha (utm_*) da URL atual; com consentimento, lembra durante a sessão. */
export function getUtm(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const fromUrl: Record<string, string> = {};
  for (const k of UTM_FIELDS) {
    const v = params.get(k);
    if (v) fromUrl[k] = v.slice(0, 120);
  }
  if (getConsent() !== "yes") return fromUrl;
  return safe(() => {
    if (Object.keys(fromUrl).length) {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(fromUrl));
      return fromUrl;
    }
    return JSON.parse(sessionStorage.getItem(UTM_KEY) ?? "{}") as Record<string, string>;
  }, fromUrl);
}

export function track(event: TrackEvent, extra: { plan?: string } = {}) {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({
    e: event,
    p: window.location.pathname,
    ref: document.referrer || null,
    utm: getUtm(),
    ...getIds(),
    ...extra,
  });
  const sent = safe(() => navigator.sendBeacon?.("/api/a", new Blob([body], { type: "application/json" })) ?? false, false);
  if (!sent) fetch("/api/a", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
}
