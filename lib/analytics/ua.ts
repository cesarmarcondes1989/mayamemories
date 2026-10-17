// Leitura simples do User-Agent (sem guardar o UA inteiro).
export type UaInfo = { device: "mobile" | "tablet" | "desktop"; browser: string; os: string; bot: boolean };

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|monitor|curl|wget|python|axios|node-fetch/i;

export function parseUserAgent(ua: string | null | undefined): UaInfo {
  const s = ua ?? "";
  const bot = !s || BOT.test(s);
  const tablet = /ipad|tablet|(android(?!.*mobile))/i.test(s);
  const mobile = !tablet && /mobi|iphone|ipod|android/i.test(s);
  const os =
    /iphone|ipad|ipod/i.test(s) ? "iOS"
    : /android/i.test(s) ? "Android"
    : /windows/i.test(s) ? "Windows"
    : /mac os x|macintosh/i.test(s) ? "macOS"
    : /cros/i.test(s) ? "ChromeOS"
    : /linux/i.test(s) ? "Linux"
    : "Outro";
  const browser =
    /instagram/i.test(s) ? "Instagram (app)"
    : /fban|fbav/i.test(s) ? "Facebook (app)"
    : /edg\//i.test(s) ? "Edge"
    : /samsungbrowser/i.test(s) ? "Samsung Internet"
    : /opr\/|opera/i.test(s) ? "Opera"
    : /firefox|fxios/i.test(s) ? "Firefox"
    : /chrome|crios/i.test(s) ? "Chrome"
    : /safari/i.test(s) ? "Safari"
    : "Outro";
  return { device: tablet ? "tablet" : mobile ? "mobile" : "desktop", browser, os, bot };
}

/** Caminho sem query e sem segredos (o token do ursinho é uma credencial). */
export function sanitizePath(path: string): string {
  const clean = (path.split(/[?#]/)[0] || "/").slice(0, 200);
  return clean
    .replace(/^\/m\/[^/]+/, "/m/:token")
    .replace(/^\/convite\/[^/]+/, "/convite/:token")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id");
}
