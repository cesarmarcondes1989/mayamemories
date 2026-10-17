// Gera as mídias da demo em public/demo (ilustrações JPG, áudios MP3, vídeo MP4).
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import { resolve } from "node:path";
const out = resolve("../../public/demo");
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
await p.goto("file://" + resolve("illustrations.html"), { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
for (const name of await p.evaluate(() => window.SCENES)) {
  await p.evaluate((n) => window.show(n), name);
  await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 82 });
}
await b.close();
