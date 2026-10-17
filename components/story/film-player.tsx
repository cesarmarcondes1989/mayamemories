"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Filme do baú: montado e tocado no navegador (canvas), sem servidor de vídeo.
// "Baixar" grava o próprio canvas + áudio em tempo real (MediaRecorder).

type Media = { type: string; url: string; mime: string };
type Item = { id: string; title: string | null; description: string | null; author: string; date: string; type: string; media: Media[] };
type Chapter = { label: string; text: string; items: Item[] };

type Scene =
  | { kind: "title"; dur: number }
  | { kind: "text"; dur: number; title: string; body: string; author?: string; bg?: "rose" | "paper" }
  | { kind: "photo"; dur: number; item: Item; url: string }
  | { kind: "video"; dur: number; item: Item; url: string }
  | { kind: "audio"; dur: number; item: Item; url: string }
  | { kind: "outro"; dur: number };

const W = 1280, H = 720;
const C = { cream: "#fdf3f4", rose: "#f6d3da", deep: "#d97a92", soft: "#fbe8ec", ink: "#4a3b40", taupe: "#8a7178", paper: "#fffaf7" };

function buildScenes(chapters: Chapter[], intro: string): Scene[] {
  const s: Scene[] = [{ kind: "title", dur: 4.5 }];
  if (intro) s.push({ kind: "text", dur: Math.min(9, 4 + intro.length / 40), title: "", body: intro, bg: "paper" });
  for (const c of chapters) {
    s.push({ kind: "text", dur: Math.min(8, 3.5 + c.text.length / 50), title: c.label, body: c.text, bg: "rose" });
    for (const i of c.items) {
      const video = i.media.find((m) => m.type === "video");
      const image = i.media.find((m) => m.type === "image");
      const audio = i.media.find((m) => m.type === "audio");
      if (video) s.push({ kind: "video", dur: 9, item: i, url: video.url });
      else if (image) s.push({ kind: "photo", dur: 4.6, item: i, url: image.url });
      else if (audio) s.push({ kind: "audio", dur: 12, item: i, url: audio.url });
      else if (i.description) s.push({ kind: "text", dur: Math.min(8, 3.5 + i.description.length / 45), title: i.title ?? "", body: i.description, author: i.author, bg: "paper" });
    }
  }
  s.push({ kind: "outro", dur: 6 });
  return s;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function cover(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, zoom: number, panX: number) {
  const r = Math.max(W / sw, H / sh) * zoom;
  const dw = sw * r, dh = sh * r;
  ctx.drawImage(src, (W - dw) / 2 + panX, (H - dh) / 2, dw, dh);
}

function contain(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, zoom: number) {
  // fundo desfocado + imagem inteira (fotos verticais não ficam cortadas)
  ctx.save();
  ctx.filter = "blur(28px) brightness(1.05)";
  cover(ctx, src, sw, sh, 1.2, 0);
  ctx.restore();
  const r = Math.min(W / sw, (H - 120) / sh) * zoom;
  const dw = sw * r, dh = sh * r;
  ctx.drawImage(src, (W - dw) / 2, (H - 120 - dh) / 2 + 10, dw, dh);
}

export function FilmPlayer({ subject, periodLabel, chapters, intro, outro, contributors, music }: {
  subject: string; periodLabel: string; chapters: Chapter[]; intro: string; outro: string; contributors: string[]; music: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scenes = useMemo(() => buildScenes(chapters, intro), [chapters, intro]);
  const starts = useMemo(() => { let t = 0; return scenes.map((s) => { const a = t; t += s.dur; return a; }); }, [scenes]);
  const total = scenes.reduce((a, s) => a + s.dur, 0);
  const [state, setState] = useState<"loading" | "ready" | "playing" | "paused" | "recording" | "done">("loading");
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const images = useRef(new Map<string, HTMLImageElement>());
  const media = useRef(new Map<string, HTMLMediaElement>());
  const audioCtx = useRef<AudioContext | null>(null);
  const out = useRef<{ dest: MediaStreamAudioDestinationNode; musicGain: GainNode } | null>(null);
  const musicEl = useRef<HTMLAudioElement | null>(null);
  const clock = useRef({ t: 0, last: 0, running: false, scene: -1 });
  const recorder = useRef<MediaRecorder | null>(null);
  const fonts = useRef({ display: "cursive", body: "sans-serif", hand: "cursive" });

  // Pré-carrega as fotos
  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    fonts.current = {
      display: css.getPropertyValue("--font-display").trim() || "cursive",
      body: css.getPropertyValue("--font-body").trim() || "sans-serif",
      hand: css.getPropertyValue("--font-hand").trim() || "cursive",
    };
    const urls = scenes.flatMap((s) => (s.kind === "photo" ? [s.url] : []));
    let n = 0;
    if (!urls.length) { setState("ready"); return; }
    for (const url of urls) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = img.onerror = () => { n++; setLoaded(n / urls.length); if (n === urls.length) setState("ready"); };
      img.src = url;
      images.current.set(url, img);
    }
  }, [scenes]);

  function ensureAudio() {
    if (audioCtx.current) return;
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    const musicGain = ctx.createGain();
    musicGain.gain.value = 0.35;
    musicGain.connect(ctx.destination);
    musicGain.connect(dest);
    const m = new Audio(music);
    m.crossOrigin = "anonymous";
    m.loop = true;
    ctx.createMediaElementSource(m).connect(musicGain);
    musicEl.current = m;
    audioCtx.current = ctx;
    out.current = { dest, musicGain };
  }

  function mediaFor(scene: Scene): HTMLMediaElement | null {
    if (scene.kind !== "video" && scene.kind !== "audio") return null;
    let el = media.current.get(scene.url);
    if (!el) {
      el = scene.kind === "video" ? document.createElement("video") : new Audio();
      el.crossOrigin = "anonymous";
      el.src = scene.url;
      el.preload = "auto";
      if (el instanceof HTMLVideoElement) el.playsInline = true;
      const ctx = audioCtx.current!;
      const src = ctx.createMediaElementSource(el);
      src.connect(ctx.destination);
      src.connect(out.current!.dest);
      media.current.set(scene.url, el);
    }
    return el;
  }

  function draw(t: number) {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const f = fonts.current;
    let i = starts.findIndex((s, k) => t >= s && t < s + scenes[k].dur);
    if (i < 0) i = scenes.length - 1;
    const scene = scenes[i];
    const lt = t - starts[i];
    const k = lt / scene.dur;

    // troca de cena: toca/pausa mídia e abaixa a trilha durante falas
    if (clock.current.scene !== i) {
      const prev = scenes[clock.current.scene];
      const prevEl = prev ? mediaFor(prev) : null;
      prevEl?.pause();
      clock.current.scene = i;
      const el = mediaFor(scene);
      if (el) { el.currentTime = 0; el.play().catch(() => {}); }
      if (out.current) out.current.musicGain.gain.setTargetAtTime(el ? 0.06 : 0.35, audioCtx.current!.currentTime, 0.4);
    }

    ctx.fillStyle = C.cream;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    if (scene.kind === "title" || scene.kind === "outro") {
      ctx.fillStyle = C.rose;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = C.deep;
      if (scene.kind === "title") {
        ctx.font = `700 150px ${f.display}`;
        ctx.fillText(subject, W / 2, H / 2 + 20);
        ctx.font = `700 34px ${f.body}`;
        ctx.fillStyle = C.ink;
        ctx.fillText(periodLabel, W / 2, H / 2 + 80);
      } else {
        ctx.font = `700 64px ${f.display}`;
        ctx.fillText("Quem guardou estas memórias", W / 2, 170);
        ctx.font = `600 28px ${f.body}`;
        ctx.fillStyle = C.ink;
        wrap(ctx, contributors.join(" · "), W - 240).slice(0, 3).forEach((l, n) => ctx.fillText(l, W / 2, 240 + n * 40));
        ctx.font = `500 36px ${f.hand}`;
        wrap(ctx, outro, W - 300).slice(0, 5).forEach((l, n) => ctx.fillText(l, W / 2, 400 + n * 46));
      }
      ctx.font = `700 40px ${f.display}`;
      ctx.fillStyle = C.deep;
      ctx.fillText("guardei pra você ♡", W / 2, H - 50);
    } else if (scene.kind === "text") {
      ctx.fillStyle = scene.bg === "rose" ? C.soft : C.cream;
      ctx.fillRect(0, 0, W, H);
      if (scene.bg === "rose") {
        ctx.font = `800 22px ${f.body}`;
        ctx.fillStyle = C.taupe;
        ctx.fillText("CAPÍTULO", W / 2, 150);
        ctx.font = `700 96px ${f.display}`;
        ctx.fillStyle = C.deep;
        ctx.fillText(scene.title, W / 2, 245);
        ctx.font = `500 30px ${f.body}`;
        ctx.fillStyle = C.ink;
        wrap(ctx, scene.body, W - 320).slice(0, 7).forEach((l, n) => ctx.fillText(l, W / 2, 330 + n * 44));
      } else {
        ctx.fillStyle = C.paper;
        ctx.shadowColor = "rgba(150,80,100,.18)"; ctx.shadowBlur = 40;
        ctx.fillRect(170, 90, W - 340, H - 180);
        ctx.shadowBlur = 0;
        ctx.fillStyle = C.ink;
        if (scene.title) { ctx.font = `700 54px ${f.display}`; ctx.fillText(scene.title, W / 2, 175); }
        ctx.font = `500 40px ${f.hand}`;
        const lines = wrap(ctx, scene.body, W - 460).slice(0, 8);
        const top = scene.title ? 245 : H / 2 - (lines.length * 50) / 2 + 30;
        lines.forEach((l, n) => ctx.fillText(l, W / 2, top + n * 50));
        if (scene.author) { ctx.font = `600 24px ${f.body}`; ctx.fillStyle = C.taupe; ctx.fillText(`— ${scene.author}`, W / 2, H - 120); }
      }
    } else if (scene.kind === "photo") {
      const img = images.current.get(scene.url);
      if (img?.complete && img.naturalWidth) {
        const portrait = img.naturalHeight > img.naturalWidth * 0.9;
        if (portrait) contain(ctx, img, img.naturalWidth, img.naturalHeight, 1 + 0.05 * k);
        else cover(ctx, img, img.naturalWidth, img.naturalHeight, 1.02 + 0.08 * k, 30 - 60 * k);
      }
    } else if (scene.kind === "video") {
      const v = media.current.get(scene.url) as HTMLVideoElement | undefined;
      if (v && v.readyState >= 2 && v.videoWidth) contain(ctx, v, v.videoWidth, v.videoHeight, 1);
    } else if (scene.kind === "audio") {
      ctx.fillStyle = C.soft;
      ctx.fillRect(0, 0, W, H);
      const pulse = 1 + 0.06 * Math.sin(lt * 5);
      ctx.beginPath(); ctx.arc(W / 2, 250, 90 * pulse, 0, Math.PI * 2); ctx.fillStyle = C.deep; ctx.fill();
      ctx.font = `90px sans-serif`; ctx.fillStyle = "#fff"; ctx.fillText("🎙", W / 2, 283);
      for (let b = 0; b < 40; b++) {
        const h = 10 + 40 * Math.abs(Math.sin(lt * 6 + b * 0.7) * Math.sin(lt * 2.3 + b * 1.3));
        ctx.fillStyle = C.deep;
        ctx.fillRect(W / 2 - 400 + b * 20, 420 - h / 2, 10, h);
      }
    }

    // legenda das memórias
    if (scene.kind === "photo" || scene.kind === "video" || scene.kind === "audio") {
      const g = ctx.createLinearGradient(0, H - 200, 0, H);
      g.addColorStop(0, "rgba(74,59,64,0)"); g.addColorStop(1, "rgba(74,59,64,.82)");
      if (scene.kind !== "audio") { ctx.fillStyle = g; ctx.fillRect(0, H - 200, W, 200); }
      const light = scene.kind !== "audio";
      ctx.textAlign = "left";
      ctx.font = `700 54px ${f.display}`;
      ctx.fillStyle = light ? "#fff" : C.ink;
      ctx.fillText(scene.item.title ?? "", 60, H - 80);
      ctx.font = `600 22px ${f.body}`;
      ctx.fillStyle = light ? "rgba(255,255,255,.85)" : C.taupe;
      const [y, m, d] = scene.item.date.split("-");
      ctx.fillText(`${d}/${m}/${y} · guardado por ${scene.item.author}`, 60, H - 42);
      if (scene.item.description && scene.kind !== "video") {
        ctx.font = `500 22px ${f.body}`;
        const line = wrap(ctx, scene.item.description, W - 120)[0];
        if (line && scene.kind === "audio") ctx.fillText(line, 60, H - 130);
      }
      ctx.textAlign = "center";
    }

    // transição suave
    const fade = Math.max(0, 1 - lt / 0.45) + Math.max(0, (lt - (scene.dur - 0.3)) / 0.3);
    if (fade > 0) { ctx.fillStyle = `rgba(253,243,244,${Math.min(1, fade)})`; ctx.fillRect(0, 0, W, H); }
  }

  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      const c = clock.current;
      if (c.running) {
        c.t += (now - c.last) / 1000;
        if (c.t >= total) {
          c.t = total - 0.01;
          c.running = false;
          stopAll();
          setState((s) => (s === "recording" ? "done" : "ready"));
          recorder.current?.stop();
        }
      }
      c.last = now;
      draw(c.t);
      setProgress(c.t / total);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, total]);

  function stopAll() {
    musicEl.current?.pause();
    for (const el of media.current.values()) el.pause();
  }

  function play(fromStart = false) {
    ensureAudio();
    audioCtx.current!.resume();
    if (fromStart) { clock.current.t = 0; clock.current.scene = -1; if (musicEl.current) musicEl.current.currentTime = 0; }
    musicEl.current!.play().catch(() => {});
    const el = clock.current.scene >= 0 ? mediaFor(scenes[clock.current.scene]) : null;
    el?.play().catch(() => {});
    clock.current.running = true;
    setState("playing");
  }
  function pause() {
    clock.current.running = false;
    stopAll();
    setState("paused");
  }

  function record() {
    ensureAudio();
    setError(null);
    setDownload(null);
    const stream = canvas.current!.captureStream(30);
    out.current!.dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    const types = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];
    const mimeType = types.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
    if (!mimeType) { setError("Este navegador não grava vídeo. Tente no Chrome ou no Safari atualizado."); return; }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      setDownload({ url: URL.createObjectURL(blob), name: `filme-${subject.toLowerCase().replace(/\s+/g, "-")}-${periodLabel.replace(/\s+/g, "-")}.${ext}` });
    };
    recorder.current = rec;
    rec.start(1000);
    play(true);
    setState("recording");
  }

  const mins = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl bg-ink shadow-[var(--shadow-soft)]">
        <canvas ref={canvas} width={W} height={H} className="block aspect-video w-full" />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-rose-soft">
        <div className="h-full bg-rose-deep" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {state === "loading" && <p className="text-taupe">Preparando as fotos… {Math.round(loaded * 100)}%</p>}
        {(state === "ready" || state === "paused" || state === "done") && (
          <button type="button" onClick={() => play(state !== "paused")} className="h-12 rounded-full bg-rose-deep px-7 font-semibold text-white">
            ▶ {state === "paused" ? "Continuar" : "Assistir"}
          </button>
        )}
        {state === "playing" && (
          <button type="button" onClick={pause} className="h-12 rounded-full border border-rose/70 bg-paper px-7 font-semibold text-rose-deep">❚❚ Pausar</button>
        )}
        {state !== "loading" && state !== "recording" && state !== "playing" && (
          <button type="button" onClick={record} className="h-12 rounded-full border border-rose/70 bg-paper px-6 font-semibold text-rose-deep">
            ⬇ Baixar o filme ({mins(total)})
          </button>
        )}
        {state === "recording" && <p className="font-semibold text-rose-deep">● Gravando… deixe esta aba aberta até o fim ({mins(total)}).</p>}
        {download && (
          <a href={download.url} download={download.name} className="h-12 content-center rounded-full bg-sage px-6 font-semibold text-white">Salvar arquivo ✓</a>
        )}
        <span className="ml-auto text-sm text-taupe">{mins(progress * total)} / {mins(total)}</span>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
