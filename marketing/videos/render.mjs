// Renderiza um HTML animado (window.render(t)) em MP4 vertical 1080x1920.
// Uso: node render.mjs video1-motion.html out/video1.mp4 [fps] [--preview t1,t2,...]
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [, , input, output, fpsArg, flag, list] = process.argv;
const fps = Number(fpsArg || 30);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto("file://" + resolve(input) + (process.env.TEMA ? `?tema=${process.env.TEMA}` : ""), { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.DURATION);
mkdirSync(dirname(output), { recursive: true });

if (flag === "--preview") {
  for (const t of list.split(",").map(Number)) {
    await page.evaluate((t) => window.render(t), t);
    await page.screenshot({ path: output.replace(/\.mp4$/, "") + `-t${t}.png` });
  }
  await browser.close();
  process.exit(0);
}

const ff = spawn("ffmpeg", [
  "-y", "-nostats", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20", "-movflags", "+faststart", output,
], { stdio: ["pipe", "ignore", "inherit"] });

const total = Math.round(duration * fps);
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.render(t), i / fps);
  const buf = await page.screenshot({ type: "png" });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 150 === 0) console.error(`frame ${i}/${total}`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
