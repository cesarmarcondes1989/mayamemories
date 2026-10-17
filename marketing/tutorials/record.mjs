// Grava os vídeos-guia navegando de verdade no Baú da Alice (demonstração).
// Uso: node marketing/tutorials/record.mjs https://guardeipravoce.com.br [slug...]
// Saída: public/tutoriais/<slug>.mp4 (1080x1920) e lib/tutorials-videos.json atualizado.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const only = process.argv.slice(3);
const ROOT = resolve(new URL("../..", import.meta.url).pathname);
const OUT = join(ROOT, "public/tutoriais");
const TMP = join(ROOT, "marketing/tutorials/.tmp");
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

// Legenda e "dedo" desenhados por cima da página
const OVERLAY = `
  (() => {
    const css = document.createElement('style');
    css.textContent = '#__cap{position:fixed;left:12px;right:12px;bottom:18px;z-index:99999;padding:12px 16px;border-radius:18px;background:rgba(74,59,64,.92);color:#fff;font:600 16px/1.35 Nunito,system-ui,sans-serif;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.25);transition:opacity .3s}#__tap{position:fixed;z-index:99998;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(217,122,146,.45);border:3px solid #d97a92;pointer-events:none;opacity:0;transition:opacity .2s}';
    document.addEventListener('DOMContentLoaded', () => {
      document.head.appendChild(css);
      const c = document.createElement('div'); c.id='__cap'; c.textContent = sessionStorage.getItem('__cap') || ''; c.style.opacity = c.textContent ? 1 : 0; document.body.appendChild(c);
      const t = document.createElement('div'); t.id='__tap'; document.body.appendChild(t);
    });
    window.__setCap = (s) => { sessionStorage.setItem('__cap', s); const c = document.getElementById('__cap'); if (c) { c.textContent = s; c.style.opacity = s ? 1 : 0; } };
    window.__tap = (x, y) => { const t = document.getElementById('__tap'); if (!t) return; t.style.left = x+'px'; t.style.top = y+'px'; t.style.opacity = 1; setTimeout(() => t.style.opacity = 0, 450); };
  })();`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function steps(page) {
  const cap = async (text, ms = 2600) => { await page.evaluate((s) => window.__setCap(s), text); await wait(ms); };
  const go = async (path) => { await page.goto(BASE + path, { waitUntil: "networkidle" }); await wait(700); };
  const scroll = async (px, ms = 1400) => { await page.mouse.wheel(0, px); await wait(ms); };
  const tap = async (locator) => {
    const el = page.locator(locator).first();
    try {
      await el.scrollIntoViewIfNeeded({ timeout: 3000 });
      const box = await el.boundingBox();
      if (box) await page.evaluate(([x, y]) => window.__tap(x, y), [box.x + box.width / 2, box.y + box.height / 2]);
      await wait(400);
      await el.click({ timeout: 3000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      await wait(900);
    } catch { /* passo opcional: segue o vídeo */ }
  };
  const type = async (locator, text) => {
    try { await page.locator(locator).first().pressSequentially(text, { delay: 70 }); await wait(500); } catch {}
  };
  return { cap, go, scroll, tap, type };
}

const SCRIPTS = {
  conhecendo: { como: "familia", run: async ({ cap, go, scroll, tap }) => {
    await go("/inicio"); await cap("Quem encosta o celular no ursinho cai aqui, já logado.");
    await cap("Daqui dá para guardar foto, áudio, recado ou carta.");
    await go("/linha-do-tempo"); await cap("A linha do tempo: tudo o que a família guardou, em ordem.");
    await scroll(700); await scroll(700);
    await tap("a[href^='/memoria/']"); await cap("Abrindo uma memória: foto, história, comentários.", 3000);
    await go("/capsulas"); await cap("Cápsulas: umas já abertas, outras esperando a data certa.", 3200);
  } },
  enviando: { como: "familia", run: async ({ cap, go, type, scroll }) => {
    await go("/inicio"); await cap("Para guardar uma memória, toque em Enviar foto.");
    await go("/enviar/foto"); await cap("Escolha do celular ou tire a foto na hora.");
    await type("input[name='title'], #title", "Domingo no parque"); await cap("Dê um título…");
    await type("textarea", "Ela riu do cachorro do vizinho a tarde toda."); await cap("…e conte o que aconteceu.");
    await scroll(500); await cap("Depois é só enviar. Quem cuida do baú aprova e pronto.", 3000);
  } },
  cartas: { como: "familia", run: async ({ cap, go, scroll }) => {
    await go("/cartas"); await cap("Cartas para o futuro: ficam trancadas até a data escolhida.", 3000);
    await scroll(500); await go("/cartas/nova"); await cap("Escolha quando ela pode abrir: 1 ano, 15, 18…", 3000);
    await scroll(500); await cap("Até lá, ninguém lê. Nem quem escreveu.", 3000);
  } },
  aprovando: { como: "admin", run: async ({ cap, go, scroll }) => {
    await go("/admin"); await cap("O painel de quem cuida do baú.", 2600);
    await go("/admin/aprovacao"); await cap("Aqui aparece o que a família mandou e ainda não foi aprovado.", 3000);
    await scroll(600); await cap("Aprove, peça ajuste ou esconda. Nada entra sem você ver.", 3200);
  } },
  familia: { como: "admin", run: async ({ cap, go, scroll, tap }) => {
    await go("/admin/pessoas"); await cap("Em Pessoas fica toda a família do baú.", 2600);
    await go("/admin/tokens"); await cap("Cada pessoa ganha um token: grava no ursinho ou vira QR.", 3000);
    await tap("summary:has-text('QR code')"); await cap("O QR já sai pronto para baixar ou imprimir.", 3200);
    await scroll(400); await cap("Perdeu o ursinho? Substitua na hora, as memórias continuam.", 3000);
  } },
  eventos: { como: "admin", run: async ({ cap, go, scroll, tap }) => {
    await go("/admin/eventos"); await cap("Eventos: chá de bebê, 1 ano, batizado…", 2600);
    await scroll(300); await tap("summary:has-text('QR code')"); await cap("O token de mesa vira um cartão com QR para os convidados.", 3200);
    await cap("O convidado escaneia, diz o nome e manda fotos. Sem cadastro.", 3000);
  } },
  exportando: { como: "admin", run: async ({ cap, go, scroll }) => {
    await go("/admin/exportacao"); await cap("Em Exportação você baixa tudo num ZIP.", 2800);
    await scroll(400); await cap("Fotos, vídeos, áudios e uma página que abre sem internet.", 3200);
  } },
};

const done = new Set(JSON.parse(readFileSync(join(ROOT, "lib/tutorials-videos.json"), "utf8")));
const browser = await chromium.launch();
for (const [slug, s] of Object.entries(SCRIPTS)) {
  if (only.length && !only.includes(slug)) continue;
  const dir = join(TMP, slug);
  rmSync(dir, { recursive: true, force: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 693 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "pt-BR",
    recordVideo: { dir, size: { width: 780, height: 1386 } },
  });
  await ctx.addInitScript(OVERLAY);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/demo/entrar?como=${s.como}`, { waitUntil: "networkidle" });
  await s.run(steps(page));
  await page.evaluate(() => window.__setCap(""));
  await wait(400);
  await ctx.close();
  const webm = join(dir, readdirSync(dir).find((f) => f.endsWith(".webm")));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-vf",
    "scale=1080:-2,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=#fdf3f4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23",
    "-movflags", "+faststart", "-an", join(OUT, `${slug}.mp4`)]);
  done.add(slug);
  console.log("ok", slug);
}
await browser.close();
writeFileSync(join(ROOT, "lib/tutorials-videos.json"), JSON.stringify([...done].sort(), null, 2) + "\n");
rmSync(TMP, { recursive: true, force: true });
