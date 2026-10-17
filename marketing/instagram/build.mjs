// Gera as imagens do Instagram (PNG) a partir de slides.html.
// Uso: node build.mjs [id1,id2,...]  → pecas/<id>.png
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(resolve("../../package.json"));
const QRCode = require("qrcode");

const DEMO = process.env.DEMO_URL ?? "https://mayamemories.vercel.app/demo?utm_source=instagram&utm_medium=carrossel&utm_campaign=como-funciona";
const qr = await QRCode.toString(DEMO, { type: "svg", margin: 0, color: { dark: "#4a3b40", light: "#00000000" } });
mkdirSync("pecas", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto("file://" + resolve("slides.html"), { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const ids = process.argv[2] ? process.argv[2].split(",") : await page.evaluate(() => Object.keys(window.SLIDES));
for (const id of ids) {
  await page.evaluate(([id, qr]) => { window.QR = qr.replace("<svg", "<svg width='100%' height='100%'"); window.show(id); }, [id, qr]);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
  await page.locator("#slide").screenshot({ path: `pecas/${id}.png` });
}
console.log(`${ids.length} peças em pecas/`);
await browser.close();
