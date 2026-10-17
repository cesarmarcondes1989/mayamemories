"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FilmAct, FilmScript } from "@/features/story/film-script";

// Filme em motion: o roteiro (atos) vira animação no canvas, quadro a quadro.
// Tudo é função do tempo (draw(t)), então dá para pular, pausar e gravar.
// "Baixar" grava o próprio canvas + áudio (MediaRecorder), sem servidor de vídeo.

type Media = { type: string; url: string; mime: string };
export type FilmItem = { title: string | null; description: string | null; author: string; date: string; media: Media[] };

type Scene =
  | { kind: "open" | "stats" | "ending" | "credits"; dur: number }
  | { kind: "act"; dur: number; act: FilmAct; chapter: number };

const C = { cream: "#fdf3f4", rose: "#f6d3da", deep: "#d97a92", soft: "#fbe8ec", ink: "#4a3b40", taupe: "#8a7178", paper: "#fffaf7", sage: "#a8c3b0", white: "#ffffff" };
const FORMATS = { h: { w: 1280, h: 720, label: "Horizontal" }, v: { w: 1080, h: 1920, label: "Vertical (stories)" } } as const;
type Format = keyof typeof FORMATS;

// ---------------------------------------------------------------- easing
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x: number) => 1 + 2.5 * Math.pow(x - 1, 3) + 1.5 * Math.pow(x - 1, 2);
const rand = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const HEART = typeof Path2D !== "undefined" ? new Path2D("M24 40C14 33 5 26 4.5 16.5 4.2 10 8.8 5 14.6 5c4.3 0 7.4 2.6 9.4 6.2C26 7.6 29.1 5 33.4 5 39.2 5 43.8 10 43.5 16.5 43 26 34 33 24 40Z") : null;
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const stamp = (date: string) => {
  const [y, m, d] = date.split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

function actDuration(act: FilmAct, items: Record<string, FilmItem>, lengths: Map<string, number>): number {
  const words = (act.line || act.heading).split(/\s+/).length;
  const first = items[act.items[0]];
  const mediaLen = (type: string) => {
    const url = first?.media.find((m) => m.type === type)?.url;
    return url ? lengths.get(url) : undefined;
  };
  switch (act.style) {
    case "chapter": return 3.6;
    case "kinetic": return clamp(2.4 + words * 0.32, 3.2, 7.5);
    case "spotlight": return 5.4;
    case "polaroids": return 2.4 + act.items.length * 1.5;
    case "collage": return 3.6 + act.items.length * 0.55;
    case "letter": return clamp(3.5 + (first?.description?.length ?? 0) / 22, 6, 14);
    case "voice": return clamp((mediaLen("audio") ?? 10) + 1.2, 5, 17);
    case "video": return clamp((mediaLen("video") ?? 10) + 0.8, 4, 15);
  }
}

export function MotionFilm({ script, items, subject, contributors, music }: {
  script: FilmScript;
  items: Record<string, FilmItem>;
  subject: string;
  contributors: string[];
  music: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<Format>("h");
  const [lengths, setLengths] = useState<Map<string, number>>(new Map());
  const [state, setState] = useState<"loading" | "ready" | "playing" | "paused" | "recording" | "done">("loading");
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scenes = useMemo<Scene[]>(() => {
    const s: Scene[] = [{ kind: "open", dur: 6.5 }];
    if (script.stats.memories >= 3) s.push({ kind: "stats", dur: 5.2 });
    let chapter = 0;
    for (const act of script.acts) {
      if (act.style === "chapter") chapter++;
      s.push({ kind: "act", act, chapter, dur: actDuration(act, items, lengths) });
    }
    s.push({ kind: "ending", dur: 7 }, { kind: "credits", dur: 7.5 });
    return s;
  }, [script, items, lengths]);
  const chapters = useMemo(() => script.acts.filter((a) => a.style === "chapter").length, [script]);
  const starts = useMemo(() => {
    let t = 0;
    return scenes.map((s) => { const a = t; t += s.dur; return a; });
  }, [scenes]);
  const total = scenes.reduce((a, s) => a + s.dur, 0);
  const cover = useMemo(() => {
    for (const a of script.acts) for (const id of a.items) {
      const img = items[id]?.media.find((m) => m.type === "image");
      if (img) return img.url;
    }
    return null;
  }, [script, items]);

  const images = useRef(new Map<string, HTMLImageElement>());
  const media = useRef(new Map<string, HTMLMediaElement>());
  const audio = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode; music: GainNode; analyser: AnalyserNode; el: HTMLAudioElement } | null>(null);
  const wired = useRef(new Set<string>());
  const clock = useRef({ t: 0, last: 0, running: false, scene: -1 });
  const recorder = useRef<MediaRecorder | null>(null);
  const fonts = useRef({ display: "cursive", body: "sans-serif", hand: "cursive" });
  const freq = useRef<Uint8Array<ArrayBuffer> | null>(null);

  // Pré-carrega fotos e a duração dos áudios/vídeos
  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    fonts.current = {
      display: css.getPropertyValue("--font-display").trim() || "cursive",
      body: css.getPropertyValue("--font-body").trim() || "sans-serif",
      hand: css.getPropertyValue("--font-hand").trim() || "cursive",
    };
    const all = script.acts.flatMap((a) => a.items.map((id) => items[id]).filter(Boolean));
    const photos = [...new Set(all.flatMap((i) => i.media.filter((m) => m.type === "image").map((m) => m.url)))];
    const timed = all.flatMap((i) => i.media.filter((m) => m.type === "video" || m.type === "audio"));
    const jobs: Promise<void>[] = [];
    let done = 0;
    const tick = () => setLoaded(++done / Math.max(1, photos.length + timed.length));
    for (const url of photos) {
      if (images.current.has(url)) continue;
      const img = new Image();
      img.crossOrigin = "anonymous";
      images.current.set(url, img);
      jobs.push(new Promise((ok) => { img.onload = img.onerror = () => { tick(); ok(); }; img.src = url; }));
    }
    const found = new Map<string, number>();
    for (const m of timed) {
      if (media.current.has(m.url)) continue;
      const el = m.type === "video" ? document.createElement("video") : new Audio();
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      if (el instanceof HTMLVideoElement) el.playsInline = true;
      media.current.set(m.url, el);
      jobs.push(new Promise((ok) => {
        const end = () => { if (Number.isFinite(el.duration)) found.set(m.url, el.duration); tick(); ok(); };
        el.onloadedmetadata = end;
        el.onerror = end;
        setTimeout(end, 6000);
        el.src = m.url;
      }));
    }
    Promise.all([...jobs, document.fonts?.ready.then(() => undefined)]).then(() => {
      if (found.size) setLengths(new Map(found));
      setState((s) => (s === "loading" ? "ready" : s));
    });
  }, [script, items]);

  function ensureAudio() {
    if (!audio.current) {
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const musicGain = ctx.createGain();
      musicGain.gain.value = 0.32;
      musicGain.connect(ctx.destination);
      musicGain.connect(dest);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      const el = new Audio(music);
      el.crossOrigin = "anonymous";
      el.loop = true;
      ctx.createMediaElementSource(el).connect(musicGain);
      audio.current = { ctx, dest, music: musicGain, analyser, el };
      freq.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    }
    const a = audio.current;
    for (const [url, el] of media.current) {
      if (wired.current.has(url)) continue;
      const src = a.ctx.createMediaElementSource(el);
      src.connect(a.ctx.destination);
      src.connect(a.dest);
      src.connect(a.analyser);
      wired.current.add(url);
    }
  }

  const mediaOf = (scene: Scene | undefined): HTMLMediaElement | null => {
    if (!scene || scene.kind !== "act" || (scene.act.style !== "voice" && scene.act.style !== "video")) return null;
    const m = items[scene.act.items[0]]?.media.find((x) => x.type === (scene.act.style === "video" ? "video" : "audio"));
    return m ? media.current.get(m.url) ?? null : null;
  };

  // ---------------------------------------------------------------- desenho
  function draw(t: number) {
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const W = cv.width, H = cv.height;
    const u = Math.min(W, H) / 720;
    const vertical = H > W;
    const f = fonts.current;
    let i = starts.findIndex((s, k) => t >= s && t < s + scenes[k].dur);
    if (i < 0) i = scenes.length - 1;
    const scene = scenes[i];
    const lt = t - starts[i];
    const d = scene.dur;
    const exit = easeInOut(prog(lt, d - 0.5, d));

    if (clock.current.scene !== i) {
      mediaOf(scenes[clock.current.scene])?.pause();
      clock.current.scene = i;
      const el = mediaOf(scene);
      if (el) {
        el.currentTime = Math.min(Math.max(0, lt - 0.3), Number.isFinite(el.duration) ? el.duration : 0);
        if (clock.current.running) el.play().catch(() => {});
      }
      const a = audio.current;
      if (a) a.music.gain.setTargetAtTime(el ? 0.05 : 0.32, a.ctx.currentTime, 0.35);
    }

    const font = (weight: number | string, size: number, family: string) => { ctx.font = `${weight} ${Math.round(size * u)}px ${family}`; };
    const wrap = (text: string, maxW: number) => {
      const lines: string[] = [];
      for (const para of text.split("\n")) {
        let line = "";
        for (const word of para.split(/\s+/).filter(Boolean)) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
        }
        if (line) lines.push(line);
      }
      return lines;
    };
    const fitFont = (text: string, weight: number, size: number, family: string, maxW: number, maxLines: number) => {
      let s = size;
      for (; s > 18; s -= 4) { font(weight, s, family); if (wrap(text, maxW).length <= maxLines) break; }
      return s;
    };

    // Texto que entra palavra por palavra (tipografia cinética)
    const kinetic = (text: string, cx: number, cy: number, maxW: number, start: number, o: { size: number; family: string; weight?: number; color: string; accent?: string; stagger?: number; maxLines?: number }) => {
      if (!text) return;
      const weight = o.weight ?? 700;
      const size = fitFont(text, weight, o.size, o.family, maxW, o.maxLines ?? 4);
      font(weight, size, o.family);
      const lines = wrap(text, maxW).slice(0, o.maxLines ?? 4);
      const lh = size * u * 1.12;
      const top = cy - ((lines.length - 1) * lh) / 2;
      const accentWords = new Set([subject.toLowerCase(), "você", "amor", "família"]);
      let k = 0;
      ctx.textAlign = "left";
      lines.forEach((line, n) => {
        const words = line.split(" ");
        const space = ctx.measureText(" ").width;
        const widths = words.map((w) => ctx.measureText(w).width);
        let x = cx - (widths.reduce((a, b) => a + b, 0) + space * (words.length - 1)) / 2;
        words.forEach((w, j) => {
          const s0 = start + k++ * (o.stagger ?? 0.09);
          const e = back(prog(lt, s0, s0 + 0.55));
          const a = easeOut(prog(lt, s0, s0 + 0.3));
          if (a > 0) {
            ctx.save();
            ctx.globalAlpha *= a;
            ctx.translate(x + widths[j] / 2, top + n * lh + (1 - e) * 46 * u);
            ctx.scale(0.6 + 0.4 * e, 0.6 + 0.4 * e);
            ctx.fillStyle = o.accent && accentWords.has(w.toLowerCase().replace(/[.,!?…:;]+$/, "")) ? o.accent : o.color;
            ctx.fillText(w, -widths[j] / 2, 0);
            ctx.restore();
          }
          x += widths[j] + space;
        });
      });
      ctx.textAlign = "center";
    };

    // Texto que se escreve sozinho (carta)
    const typewriter = (text: string, x: number, y: number, maxW: number, p: number, lh: number, maxLines: number) => {
      const lines = wrap(text, maxW).slice(0, maxLines);
      const totalChars = lines.reduce((a, l) => a + l.length, 0);
      let left = Math.floor(totalChars * p);
      ctx.textAlign = "left";
      let pen = { x, y };
      lines.forEach((l, n) => {
        if (left <= 0) return;
        const part = l.slice(0, left);
        left -= l.length;
        ctx.fillText(part, x, y + n * lh);
        pen = { x: x + ctx.measureText(part).width, y: y + n * lh };
      });
      ctx.textAlign = "center";
      return pen;
    };

    const rrect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    };
    const heart = (cx: number, cy: number, size: number, mode: "fill" | "stroke", p = 1) => {
      if (!HEART) return;
      ctx.save();
      ctx.translate(cx - (size / 48) * 24, cy - (size / 48) * 22);
      ctx.scale(size / 48, size / 48);
      if (mode === "stroke") {
        ctx.setLineDash([140, 140]);
        ctx.lineDashOffset = 140 * (1 - p);
        ctx.lineWidth = 2.6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke(HEART);
      } else ctx.fill(HEART);
      ctx.restore();
    };
    const imageOf = (id: string) => {
      const url = items[id]?.media.find((m) => m.type === "image")?.url;
      const img = url ? images.current.get(url) : undefined;
      return img?.complete && img.naturalWidth ? img : null;
    };
    const coverDraw = (src: CanvasImageSource, sw: number, sh: number, x: number, y: number, w: number, h: number, zoom = 1, px = 0, py = 0) => {
      const r = Math.max(w / sw, h / sh) * zoom;
      const dw = sw * r, dh = sh * r;
      ctx.drawImage(src, x + (w - dw) / 2 + px, y + (h - dh) / 2 + py, dw, dh);
    };
    const background = (color: string, dots = C.deep, alpha = 0.18) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = dots;
      for (let n = 0; n < 22; n++) {
        const x = rand(n + 1) * W + Math.sin(t * 0.4 + n) * 20 * u;
        const y = H - (((rand(n + 7) * H + t * (14 + rand(n) * 22) * u) % (H + 60 * u)) - 30 * u);
        ctx.globalAlpha = alpha * (0.4 + rand(n + 3) * 0.6);
        if (n % 4 === 0) heart(x, y, (10 + rand(n) * 14) * u, "fill");
        else { ctx.beginPath(); ctx.arc(x, y, (2 + rand(n + 2) * 4) * u, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    };
    const pill = (text: string, x: number, y: number, bg: string, fg: string, size = 22, align: "left" | "center" = "left") => {
      font(800, size, f.body);
      const w = ctx.measureText(text).width + 40 * u;
      const h = size * u * 1.9;
      const left = align === "center" ? x - w / 2 : x;
      ctx.fillStyle = bg;
      rrect(left, y - h / 2, w, h, h / 2);
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, left + w / 2, y + 1);
      ctx.textBaseline = "alphabetic";
    };
    const caption = (item: FilmItem | undefined, act: FilmAct, appear: number, dark: boolean) => {
      if (!item) return;
      const a = easeOut(prog(lt, appear, appear + 0.6)) * (1 - exit);
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(0, (1 - a) * 40 * u);
      const x = 56 * u;
      const bottom = H - (vertical ? 170 : 56) * u;
      const title = act.heading || item.title || "";
      if (dark) {
        const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
        g.addColorStop(0, "rgba(74,59,64,0)");
        g.addColorStop(1, "rgba(74,59,64,.8)");
        ctx.fillStyle = g;
        ctx.fillRect(0, H * 0.55, W, H * 0.45);
      }
      ctx.textAlign = "left";
      const maxW = W - 2 * x;
      font(600, 22, f.body);
      ctx.fillStyle = dark ? "rgba(255,255,255,.9)" : C.taupe;
      ctx.fillText(`${stamp(item.date)} · guardado por ${item.author}`, x, bottom);
      let lines = 0;
      if (act.line) {
        font(500, 26, f.body);
        ctx.fillStyle = dark ? C.white : C.ink;
        const wrapped = wrap(act.line, maxW).slice(0, 2);
        lines = wrapped.length;
        wrapped.reverse().forEach((l, n) => ctx.fillText(l, x, bottom - (40 + n * 34) * u));
      }
      const s = fitFont(title, 700, 64, f.display, maxW, 1);
      font(700, s, f.display);
      ctx.fillStyle = dark ? C.white : C.ink;
      ctx.fillText(title, x, bottom - (48 + lines * 34) * u);
      ctx.restore();
      ctx.textAlign = "center";
    };

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    if (scene.kind === "open") {
      background(C.cream);
      const img = cover ? images.current.get(cover) : null;
      if (img?.complete && img.naturalWidth) {
        const r = Math.max(W, H) * easeOut(prog(lt, 2.4, 4.5)) * 0.75;
        if (r > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
          ctx.clip();
          coverDraw(img, img.naturalWidth, img.naturalHeight, 0, 0, W, H, 1.15 - 0.1 * prog(lt, 2.4, d));
          ctx.fillStyle = "rgba(253,243,244,.78)";
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
        }
      }
      const hp = easeInOut(prog(lt, 0.2, 1.6));
      const beat = 1 + 0.06 * Math.max(0, Math.sin((lt - 1.6) * 5)) * prog(lt, 1.6, 1.8);
      ctx.strokeStyle = C.deep;
      ctx.fillStyle = C.deep;
      const hs = 120 * u * beat * (1 - 0.45 * easeInOut(prog(lt, 1.8, 2.5)));
      const hy = H / 2 - easeInOut(prog(lt, 1.8, 2.5)) * (vertical ? 330 : 190) * u;
      heart(W / 2, hy, hs, "stroke", hp);
      ctx.globalAlpha = prog(lt, 1.4, 1.8);
      heart(W / 2, hy, hs, "fill");
      ctx.globalAlpha = 1;
      font(700, 30, f.display);
      ctx.fillStyle = C.deep;
      ctx.globalAlpha = easeOut(prog(lt, 2.2, 2.8)) * (1 - exit);
      ctx.fillText("guardei pra você apresenta", W / 2, hy + 80 * u);
      ctx.globalAlpha = 1 - exit;
      kinetic(script.title, W / 2, H / 2 + 30 * u, W - 140 * u, 2.6, { size: vertical ? 150 : 120, family: f.display, color: C.ink, accent: C.deep, maxLines: 3 });
      font(700, 30, f.body);
      ctx.fillStyle = C.taupe;
      ctx.globalAlpha = easeOut(prog(lt, 4, 4.6)) * (1 - exit);
      ctx.fillText(script.tagline, W / 2, H / 2 + (vertical ? 250 : 150) * u);
      ctx.globalAlpha = 1;
    } else if (scene.kind === "stats") {
      background(C.soft);
      kinetic("Tudo isso foi guardado pra você", W / 2, (vertical ? 300 : 150) * u, W - 120 * u, 0.3, { size: 78, family: f.display, color: C.ink, accent: C.deep, maxLines: 2 });
      const s = script.stats;
      const cards = [
        { n: s.memories, label: s.memories === 1 ? "lembrança" : "lembranças", icon: "♡" },
        { n: s.people, label: s.people === 1 ? "pessoa" : "pessoas", icon: "☺" },
        s.voices ? { n: s.voices, label: s.voices === 1 ? "voz gravada" : "vozes gravadas", icon: "♪" } : { n: s.photos, label: "fotos", icon: "▣" },
      ];
      const cw = (vertical ? 560 : 300) * u, ch = (vertical ? 200 : 250) * u, gap = 34 * u;
      cards.forEach((c, n) => {
        const st = 0.9 + n * 0.35;
        const e = back(prog(lt, st, st + 0.6));
        if (e <= 0) return;
        const x = vertical ? W / 2 - cw / 2 : W / 2 - (cw * 3 + gap * 2) / 2 + n * (cw + gap);
        const y = vertical ? 440 * u + n * (ch + gap) : 290 * u;
        ctx.save();
        ctx.globalAlpha = clamp(e) * (1 - exit);
        ctx.translate(x + cw / 2, y + ch / 2 + exit * 60 * u * (n + 1));
        ctx.scale(e, e);
        ctx.shadowColor = "rgba(150,80,100,.18)";
        ctx.shadowBlur = 40 * u;
        ctx.fillStyle = C.paper;
        rrect(-cw / 2, -ch / 2, cw, ch, 40 * u);
        ctx.fill();
        ctx.shadowBlur = 0;
        const count = Math.round(c.n * easeOut(prog(lt, st + 0.2, st + 1.6)));
        font(700, 120, f.display);
        ctx.fillStyle = C.deep;
        ctx.fillText(String(count), 0, 30 * u);
        font(800, 24, f.body);
        ctx.fillStyle = C.ink;
        ctx.fillText(`${c.icon}  ${c.label}`, 0, 85 * u);
        ctx.restore();
      });
    } else if (scene.kind === "ending") {
      background(C.deep, C.white, 0.25);
      ctx.globalAlpha = 1 - exit;
      font(800, 22, f.body);
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.globalAlpha = easeOut(prog(lt, 0.3, 0.9)) * (1 - exit);
      ctx.fillText(`PARA ${subject.toUpperCase()}`, W / 2, H / 2 - (vertical ? 360 : 210) * u);
      ctx.globalAlpha = 1 - exit;
      kinetic(script.ending, W / 2, H / 2, W - (vertical ? 120 : 220) * u, 0.6, { size: vertical ? 96 : 76, family: f.hand, weight: 600, color: C.white, stagger: 0.12, maxLines: vertical ? 7 : 4 });
      ctx.globalAlpha = 1;
    } else if (scene.kind === "credits") {
      background(C.cream);
      kinetic("Quem guardou estas memórias", W / 2, (vertical ? 330 : 120) * u, W - 120 * u, 0.2, { size: 70, family: f.display, color: C.ink, accent: C.deep, maxLines: 2 });
      const people = contributors.slice(0, vertical ? 12 : 10);
      const cols = vertical ? 3 : Math.min(5, people.length);
      const size = 120 * u, gx = (vertical ? 300 : 220) * u, gy = 190 * u;
      const rows = Math.ceil(people.length / cols);
      const top = (vertical ? 620 : 230) * u;
      const end = 0.8 + people.length * 0.18;
      const shrink = easeInOut(prog(lt, end + 0.6, end + 1.4));
      people.forEach((name, n) => {
        const r = Math.floor(n / cols), c = n % cols;
        const inRow = Math.min(cols, people.length - r * cols);
        const x = W / 2 + (c - (inRow - 1) / 2) * gx;
        const y = top + r * gy;
        const e = back(prog(lt, 0.8 + n * 0.18, 1.4 + n * 0.18));
        if (e <= 0) return;
        ctx.save();
        ctx.globalAlpha = clamp(e) * (1 - shrink);
        ctx.translate(x, y);
        ctx.scale(e, e);
        ctx.fillStyle = [C.deep, C.sage, "#e7a9b7", "#c9a98f"][n % 4];
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
        font(800, 42, f.body);
        ctx.fillStyle = C.white;
        ctx.textBaseline = "middle";
        ctx.fillText(initials(name), 0, 2 * u);
        ctx.textBaseline = "alphabetic";
        font(700, 22, f.body);
        ctx.fillStyle = C.ink;
        ctx.fillText(name.length > 18 ? `${name.slice(0, 17)}…` : name, 0, size / 2 + 34 * u);
        ctx.restore();
      });
      if (shrink > 0) {
        const cy = top + ((rows - 1) * gy) / 2;
        ctx.globalAlpha = shrink;
        ctx.fillStyle = C.deep;
        const beat = 1 + 0.07 * Math.max(0, Math.sin(lt * 6));
        heart(W / 2, cy - 40 * u, 110 * u * beat, "fill");
        font(700, 64, f.display);
        ctx.fillText("guardei pra você", W / 2, cy + 90 * u);
        font(600, 22, f.body);
        ctx.fillStyle = C.taupe;
        ctx.fillText("o baú da família para a criança abrir quando crescer", W / 2, cy + 135 * u);
        ctx.globalAlpha = 1;
      }
      const fade = prog(lt, d - 1, d);
      if (fade > 0) { ctx.fillStyle = `rgba(253,243,244,${fade})`; ctx.fillRect(0, 0, W, H); }
    } else {
      const { act, chapter } = scene as Extract<Scene, { kind: "act" }>;
      const first = items[act.items[0]];
      switch (act.style) {
        case "chapter": {
          background(C.deep, C.white, 0.22);
          ctx.globalAlpha = 1 - exit;
          font(800, 20, f.body);
          ctx.fillStyle = "rgba(255,255,255,.85)";
          ctx.globalAlpha = easeOut(prog(lt, 0.3, 0.8)) * (1 - exit);
          ctx.fillText(`C A P Í T U L O   ${chapter}`, W / 2, H / 2 - (vertical ? 200 : 130) * u);
          ctx.globalAlpha = 1 - exit;
          kinetic(act.heading, W / 2, H / 2 - 20 * u, W - 120 * u, 0.4, { size: vertical ? 150 : 130, family: f.display, color: C.white, maxLines: 2, stagger: 0.14 });
          font(500, 28, f.body);
          ctx.fillStyle = C.white;
          ctx.globalAlpha = easeOut(prog(lt, 1.2, 1.8)) * (1 - exit);
          wrap(act.line, W - (vertical ? 160 : 300) * u).slice(0, 3).forEach((l, n) => ctx.fillText(l, W / 2, H / 2 + (vertical ? 130 : 80) * u + n * 40 * u));
          // linha do tempo
          const ly = H - (vertical ? 240 : 70) * u, lx = 120 * u, lw = W - 240 * u;
          const lp = easeInOut(prog(lt, 0.2, 1.6));
          ctx.globalAlpha = 0.9 * (1 - exit);
          ctx.strokeStyle = "rgba(255,255,255,.5)";
          ctx.lineWidth = 3 * u;
          ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + lw * lp, ly); ctx.stroke();
          for (let n = 0; n < chapters; n++) {
            const x = lx + lw * (chapters > 1 ? n / (chapters - 1) : 0.5);
            if ((x - lx) / lw > lp) continue;
            ctx.fillStyle = n === chapter - 1 ? C.white : "rgba(255,255,255,.55)";
            const r = (n === chapter - 1 ? 11 * back(prog(lt, 1.4, 1.9)) : 5) * u;
            ctx.beginPath(); ctx.arc(x, ly, Math.max(0, r), 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
          break;
        }
        case "kinetic": {
          background(C.soft);
          if (act.heading) {
            font(800, 22, f.body);
            ctx.fillStyle = C.taupe;
            ctx.globalAlpha = easeOut(prog(lt, 0.2, 0.7)) * (1 - exit);
            ctx.fillText(act.heading.toUpperCase(), W / 2, H / 2 - (vertical ? 330 : 200) * u);
          }
          ctx.globalAlpha = 1 - exit;
          ctx.save();
          ctx.translate(0, -exit * 50 * u);
          kinetic(act.line || act.heading, W / 2, H / 2, W - (vertical ? 120 : 200) * u, 0.3, { size: vertical ? 110 : 90, family: f.display, color: C.ink, accent: C.deep, maxLines: vertical ? 7 : 4, stagger: 0.12 });
          ctx.restore();
          ctx.globalAlpha = 1;
          break;
        }
        case "spotlight": {
          ctx.fillStyle = C.ink;
          ctx.fillRect(0, 0, W, H);
          const img = imageOf(act.items[0]);
          if (img) {
            const r = Math.hypot(W, H) * 0.55 * easeOut(prog(lt, 0.1, 0.9));
            ctx.save();
            ctx.beginPath();
            ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
            ctx.clip();
            const k = prog(lt, 0, d);
            const portrait = img.naturalHeight > img.naturalWidth;
            if (portrait !== vertical) {
              ctx.save();
              ctx.filter = "blur(30px) brightness(1.05)";
              coverDraw(img, img.naturalWidth, img.naturalHeight, 0, 0, W, H, 1.3);
              ctx.restore();
              const rr = Math.min(W / img.naturalWidth, H / img.naturalHeight) * (0.94 + 0.05 * k);
              const dw = img.naturalWidth * rr, dh = img.naturalHeight * rr;
              ctx.shadowColor = "rgba(0,0,0,.3)";
              ctx.shadowBlur = 40 * u;
              ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
              ctx.shadowBlur = 0;
            } else coverDraw(img, img.naturalWidth, img.naturalHeight, 0, 0, W, H, 1.16 - 0.12 * k, (rand(scene.dur) - 0.5) * 80 * u * k, 0);
            ctx.restore();
          }
          caption(first, act, 1, true);
          // carimbo da data
          if (first) {
            const e = prog(lt, 1.6, 2);
            if (e > 0) {
              ctx.save();
              ctx.globalAlpha = Math.min(1, e * 1.4) * (1 - exit) * 0.92;
              ctx.translate(W - 150 * u, (vertical ? 230 : 110) * u);
              ctx.rotate(-0.18);
              ctx.scale(1 + (1 - easeOut(e)) * 1.2, 1 + (1 - easeOut(e)) * 1.2);
              ctx.strokeStyle = C.white;
              ctx.lineWidth = 4 * u;
              ctx.beginPath(); ctx.arc(0, 0, 78 * u, 0, Math.PI * 2); ctx.stroke();
              ctx.beginPath(); ctx.arc(0, 0, 66 * u, 0, Math.PI * 2); ctx.stroke();
              ctx.fillStyle = C.white;
              const [dd, mm, yy] = stamp(first.date).split(" ");
              font(800, 40, f.body); ctx.fillText(dd, 0, -2 * u);
              font(800, 20, f.body); ctx.fillText(`${mm} ${yy}`, 0, 28 * u);
              ctx.restore();
            }
          }
          break;
        }
        case "polaroids":
        case "collage": {
          background(act.style === "polaroids" ? "#f7ece6" : C.cream);
          const n = act.items.length;
          ctx.save();
          const zoom = 1 + 0.05 * prog(lt, 0, d);
          ctx.translate(W / 2, H / 2);
          ctx.scale(zoom, zoom);
          ctx.translate(-W / 2, -H / 2);
          if (act.style === "polaroids") {
            const pw = (vertical ? 380 : 330) * u;
            act.items.forEach((id: string, k: number) => {
              const st = 0.4 + k * 1.3;
              const e = back(prog(lt, st, st + 0.8));
              if (e <= 0) return;
              const spread = vertical ? (k % 2 ? 1 : -1) * 70 * u : (k - (n - 1) / 2) * 290 * u;
              const vy = vertical ? 80 * u + (k - (n - 1) / 2) * (n > 3 ? 190 : 250) * u : 0;
              const rot = (rand(k + n) - 0.5) * 0.32;
              const x = W / 2 + spread + (rand(k + 9) - 0.5) * 40 * u;
              const y = H / 2 + vy + 20 * u - (1 - e) * H * 0.9;
              ctx.save();
              ctx.globalAlpha = 1 - exit;
              ctx.translate(x, y);
              ctx.rotate(rot * e + (1 - e) * 0.6);
              ctx.shadowColor = "rgba(90,50,60,.28)";
              ctx.shadowBlur = 30 * u;
              ctx.shadowOffsetY = 12 * u;
              ctx.fillStyle = C.white;
              ctx.fillRect(-pw / 2, -pw / 2 - 20 * u, pw, pw + 80 * u);
              ctx.shadowColor = "transparent";
              const img = imageOf(id);
              if (img) {
                ctx.save();
                ctx.beginPath(); ctx.rect(-pw / 2 + 18 * u, -pw / 2 - 2 * u, pw - 36 * u, pw - 36 * u); ctx.clip();
                coverDraw(img, img.naturalWidth, img.naturalHeight, -pw / 2 + 18 * u, -pw / 2 - 2 * u, pw - 36 * u, pw - 36 * u);
                ctx.restore();
              }
              font(600, 30, f.hand);
              ctx.fillStyle = C.ink;
              const title = items[id]?.title ?? "";
              ctx.fillText(title.length > 24 ? `${title.slice(0, 23)}…` : title, 0, pw / 2 + 32 * u);
              ctx.restore();
            });
          } else {
            const cols = vertical ? 2 : n <= 3 ? n : 3;
            const rows = Math.ceil(n / cols);
            const gap = 16 * u;
            const areaW = W - (vertical ? 80 : 140) * u, areaH = H - (vertical ? 520 : 220) * u;
            const tw = (areaW - gap * (cols - 1)) / cols, th = (areaH - gap * (rows - 1)) / rows;
            const ox = (W - areaW) / 2, oy = (vertical ? 330 : 150) * u;
            act.items.forEach((id: string, k: number) => {
              const st = 0.3 + k * 0.28;
              const e = back(prog(lt, st, st + 0.6));
              if (e <= 0) return;
              const c = k % cols, r = Math.floor(k / cols);
              const inRow = Math.min(cols, n - r * cols);
              const rowShift = ((cols - inRow) * (tw + gap)) / 2;
              const x = ox + rowShift + c * (tw + gap), y = oy + r * (th + gap);
              ctx.save();
              ctx.globalAlpha = clamp(e) * (1 - exit);
              ctx.translate(x + tw / 2, y + th / 2);
              ctx.rotate((1 - e) * (k % 2 ? 0.2 : -0.2));
              ctx.scale(0.5 + 0.5 * e, 0.5 + 0.5 * e);
              rrect(-tw / 2, -th / 2, tw, th, 28 * u);
              ctx.save();
              ctx.clip();
              ctx.fillStyle = C.rose;
              ctx.fillRect(-tw / 2, -th / 2, tw, th);
              const img = imageOf(id);
              if (img) coverDraw(img, img.naturalWidth, img.naturalHeight, -tw / 2, -th / 2, tw, th, 1.1 - 0.08 * prog(lt, st, d));
              ctx.restore();
              ctx.restore();
            });
          }
          ctx.restore();
          // título
          const title = act.heading || first?.title || "";
          ctx.globalAlpha = 1 - exit;
          if (act.style === "polaroids") {
            kinetic(title, W / 2, (vertical ? 210 : 72) * u, W - 160 * u, 0.2, { size: 64, family: f.display, color: C.ink, accent: C.deep, maxLines: 1 });
          } else {
            kinetic(title, W / 2, (vertical ? 210 : 92) * u, W - 160 * u, 0.2, { size: 68, family: f.display, color: C.ink, accent: C.deep, maxLines: 1 });
            const authors = [...new Set(act.items.map((id: string) => items[id]?.author).filter(Boolean))].slice(0, 3).join(", ");
            ctx.globalAlpha = easeOut(prog(lt, 1.2, 1.8)) * (1 - exit);
            if (first) pill(`${stamp(first.date)} · ${authors}`, W / 2, H - (vertical ? 150 : 42) * u, C.deep, C.white, 20, "center");
          }
          if (act.line && act.style === "polaroids") {
            font(500, 26, f.body);
            ctx.fillStyle = C.taupe;
            ctx.globalAlpha = easeOut(prog(lt, d - 2.4, d - 1.8)) * (1 - exit);
            ctx.fillText(wrap(act.line, W - 200 * u)[0] ?? "", W / 2, H - (vertical ? 140 : 30) * u);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case "letter": {
          background("#f3e6e0", C.deep, 0.12);
          const pw = Math.min(W - 120 * u, (vertical ? 900 : 860) * u), ph = H - (vertical ? 420 : 110) * u;
          const unfold = back(prog(lt, 0.2, 0.9));
          ctx.save();
          ctx.globalAlpha = 1 - exit;
          ctx.translate(W / 2, H / 2 + exit * 60 * u);
          ctx.rotate(-0.012);
          ctx.scale(1, Math.max(0.02, unfold));
          ctx.shadowColor = "rgba(120,70,80,.22)";
          ctx.shadowBlur = 50 * u;
          ctx.fillStyle = C.paper;
          rrect(-pw / 2, -ph / 2, pw, ph, 16 * u);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = "rgba(217,122,146,.18)";
          ctx.lineWidth = 2 * u;
          const lh = (vertical ? 66 : 50) * u;
          for (let y = -ph / 2 + 150 * u; y < ph / 2 - 40 * u; y += lh) {
            ctx.beginPath(); ctx.moveTo(-pw / 2 + 50 * u, y + 10 * u); ctx.lineTo(pw / 2 - 50 * u, y + 10 * u); ctx.stroke();
          }
          if (unfold > 0.9) {
            font(700, 54, f.display);
            ctx.fillStyle = C.deep;
            ctx.fillText(act.heading || first?.title || "Uma carta pra você", 0, -ph / 2 + 90 * u);
            font(500, vertical ? 44 : 36, f.hand);
            ctx.fillStyle = C.ink;
            const maxLines = Math.floor((ph - 230 * u) / lh);
            const p = prog(lt, 1, d - 1.6);
            const pen = typewriter(first?.description ?? act.line, -pw / 2 + 60 * u, -ph / 2 + 150 * u, pw - 120 * u, p, lh, maxLines);
            if (p < 1) { ctx.fillStyle = C.deep; ctx.beginPath(); ctx.arc(pen.x + 8 * u, pen.y - 10 * u, 5 * u, 0, Math.PI * 2); ctx.fill(); }
            font(600, 30, f.hand);
            ctx.fillStyle = C.taupe;
            ctx.globalAlpha = easeOut(prog(lt, d - 1.6, d - 1)) * (1 - exit);
            ctx.textAlign = "right";
            ctx.fillText(`— ${first?.author ?? ""}, ${first ? stamp(first.date).toLowerCase() : ""}`, pw / 2 - 60 * u, ph / 2 - 40 * u);
            ctx.textAlign = "center";
          }
          ctx.restore();
          break;
        }
        case "voice": {
          background(C.soft);
          const a = audio.current;
          let level = 0.15 + 0.1 * Math.sin(lt * 4);
          const bars: number[] = [];
          if (a && freq.current && clock.current.running) {
            a.analyser.getByteFrequencyData(freq.current);
            const arr = freq.current;
            level = arr.slice(2, 20).reduce((s, v) => s + v, 0) / (18 * 255);
            for (let b = 0; b < 32; b++) bars.push(arr[2 + b] / 255);
          } else for (let b = 0; b < 32; b++) bars.push(0.2 + 0.3 * Math.abs(Math.sin(lt * 5 + b * 0.7) * Math.sin(lt * 2.1 + b)));
          const cy = H / 2 - (vertical ? 200 : 70) * u;
          const R = (vertical ? 170 : 110) * u;
          const e = back(prog(lt, 0.2, 0.8));
          ctx.globalAlpha = 1 - exit;
          for (let k = 0; k < 3; k++) {
            const ph = (lt * 0.7 + k / 3) % 1;
            ctx.strokeStyle = `rgba(217,122,146,${0.5 * (1 - ph)})`;
            ctx.lineWidth = 4 * u;
            ctx.beginPath(); ctx.arc(W / 2, cy, R * e + ph * 160 * u, 0, Math.PI * 2); ctx.stroke();
          }
          const pulse = 1 + level * 0.25;
          ctx.save();
          ctx.translate(W / 2, cy);
          ctx.scale(e * pulse, e * pulse);
          ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
          ctx.fillStyle = C.deep;
          ctx.fill();
          const photo = first ? imageOf(act.items[0]) : null;
          if (photo) {
            ctx.save(); ctx.clip();
            coverDraw(photo, photo.naturalWidth, photo.naturalHeight, -R, -R, 2 * R, 2 * R);
            ctx.restore();
          } else {
            font(800, vertical ? 110 : 76, f.body);
            ctx.fillStyle = C.white;
            ctx.textBaseline = "middle";
            ctx.fillText(initials(first?.author ?? "♡"), 0, 4 * u);
            ctx.textBaseline = "alphabetic";
          }
          ctx.restore();
          // onda
          const bw = (vertical ? 22 : 18) * u, total = bars.length * bw * 1.6;
          const by = cy + R + (vertical ? 140 : 90) * u;
          ctx.fillStyle = C.deep;
          bars.forEach((v, b) => {
            const h = (8 + v * (vertical ? 120 : 80)) * u * e;
            rrect(W / 2 - total / 2 + b * bw * 1.6, by - h / 2, bw, h, bw / 2);
            ctx.fill();
          });
          kinetic(act.heading || first?.title || "", W / 2, by + (vertical ? 160 : 92) * u, W - 160 * u, 0.6, { size: 60, family: f.display, color: C.ink, accent: C.deep, maxLines: 1 });
          if (act.line) {
            font(500, vertical ? 34 : 26, f.body);
            ctx.fillStyle = C.taupe;
            ctx.globalAlpha = easeOut(prog(lt, 1.2, 1.8)) * (1 - exit);
            wrap(`“${act.line}”`, W - 240 * u).slice(0, 2).forEach((l, n) => ctx.fillText(l, W / 2, by + (vertical ? 240 : 140) * u + n * 36 * u));
          }
          ctx.globalAlpha = easeOut(prog(lt, 1, 1.5)) * (1 - exit);
          if (first) pill(`a voz de ${first.author} · ${stamp(first.date).toLowerCase()}`, W / 2, (vertical ? 200 : 46) * u, C.paper, C.deep, 20, "center");
          ctx.globalAlpha = 1;
          break;
        }
        case "video": {
          background(C.cream);
          const url = first?.media.find((m) => m.type === "video")?.url;
          const v = url ? (media.current.get(url) as HTMLVideoElement | undefined) : undefined;
          const e = back(prog(lt, 0.2, 0.9));
          const vw = v?.videoWidth || 16, vh = v?.videoHeight || 9;
          const maxW = W - (vertical ? 100 : 260) * u, maxH = H - (vertical ? 560 : 210) * u;
          const r = Math.min(maxW / vw, maxH / vh);
          const fw = vw * r, fh = vh * r;
          const cy = H / 2 - (vertical ? 60 : 30) * u + Math.sin(lt * 1.3) * 5 * u;
          ctx.save();
          ctx.globalAlpha = clamp(e) * (1 - exit);
          ctx.translate(W / 2, cy);
          ctx.rotate(-0.015 + (1 - e) * 0.15);
          ctx.scale(0.6 + 0.4 * e, 0.6 + 0.4 * e);
          ctx.shadowColor = "rgba(90,50,60,.25)";
          ctx.shadowBlur = 40 * u;
          ctx.fillStyle = C.white;
          rrect(-fw / 2 - 16 * u, -fh / 2 - 16 * u, fw + 32 * u, fh + 32 * u, 26 * u);
          ctx.fill();
          ctx.shadowBlur = 0;
          rrect(-fw / 2, -fh / 2, fw, fh, 16 * u);
          ctx.save();
          ctx.clip();
          ctx.fillStyle = C.ink;
          ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
          if (v && v.readyState >= 2) ctx.drawImage(v, -fw / 2, -fh / 2, fw, fh);
          ctx.restore();
          // fita adesiva
          ctx.fillStyle = "rgba(246,211,218,.85)";
          ctx.save(); ctx.translate(-fw / 2 + 30 * u, -fh / 2 - 6 * u); ctx.rotate(-0.5); ctx.fillRect(-60 * u, -16 * u, 120 * u, 32 * u); ctx.restore();
          ctx.save(); ctx.translate(fw / 2 - 30 * u, -fh / 2 - 6 * u); ctx.rotate(0.5); ctx.fillRect(-60 * u, -16 * u, 120 * u, 32 * u); ctx.restore();
          ctx.restore();
          ctx.globalAlpha = 1 - exit;
          const ty = cy + fh / 2 + (vertical ? 120 : 70) * u;
          kinetic(act.heading || first?.title || "", W / 2, Math.min(ty, H - 60 * u), W - 160 * u, 0.6, { size: vertical ? 70 : 52, family: f.display, color: C.ink, accent: C.deep, maxLines: 1 });
          if (first && vertical) {
            ctx.globalAlpha = easeOut(prog(lt, 1, 1.5)) * (1 - exit);
            pill(`${stamp(first.date).toLowerCase()} · ${first.author}`, W / 2, ty + 90 * u, C.deep, C.white, 20, "center");
          }
          ctx.globalAlpha = 1;
          break;
        }
      }
    }

    // Transição: faixas diagonais varrem a tela no corte entre cenas
    const tones = [C.deep, C.rose, C.sage, "#e7a9b7"];
    for (const boundary of [i, i + 1]) {
      if (boundary <= 0 || boundary >= scenes.length) continue;
      const T = starts[boundary];
      const p = prog(t, T - 0.35, T + 0.35);
      if (p <= 0 || p >= 1) continue;
      const BW = W + H * 1.2 + 80 * u;
      [0, 1].forEach((layer) => {
        const q = clamp(p + (layer ? -0.07 : 0.07));
        const cx = -BW / 2 - H / 2 + easeInOut(q) * (W + BW + H);
        ctx.fillStyle = layer ? tones[boundary % tones.length] : tones[(boundary + 1) % tones.length];
        ctx.beginPath();
        ctx.moveTo(cx - BW / 2 + H / 2, 0);
        ctx.lineTo(cx + BW / 2 + H / 2, 0);
        ctx.lineTo(cx + BW / 2 - H / 2, H);
        ctx.lineTo(cx - BW / 2 - H / 2, H);
        ctx.closePath();
        ctx.fill();
      });
    }

    // marca d'água discreta
    if (scene.kind === "act") {
      ctx.globalAlpha = 0.75;
      font(700, 22, f.display);
      ctx.fillStyle = scene.act.style === "spotlight" || scene.act.style === "chapter" ? C.white : C.deep;
      ctx.textAlign = "right";
      ctx.fillText("guardei pra você ♡", W - 26 * u, H - 22 * u);
      ctx.textAlign = "center";
      ctx.globalAlpha = 1;
    }
  }

  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      const c = clock.current;
      if (c.running) {
        c.t += Math.min(0.1, (now - c.last) / 1000);
        if (c.t >= total) {
          c.t = total - 0.01;
          c.running = false;
          stopAll();
          setState((s) => (s === "recording" ? "done" : "ready"));
          if (recorder.current?.state === "recording") recorder.current.stop();
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
  }, [scenes, total, format]);

  function stopAll() {
    audio.current?.el.pause();
    for (const el of media.current.values()) el.pause();
  }

  function play(fromStart = false) {
    ensureAudio();
    const a = audio.current!;
    a.ctx.resume();
    if (fromStart) { clock.current.t = 0; a.el.currentTime = 0; }
    clock.current.scene = -1; // reinicia a mídia da cena atual
    a.el.play().catch(() => {});
    clock.current.running = true;
    setState("playing");
  }
  function pause() {
    clock.current.running = false;
    stopAll();
    setState("paused");
  }
  function seek(fraction: number) {
    if (state === "recording" || state === "loading") return;
    clock.current.t = clamp(fraction) * total;
    clock.current.scene = -1;
    if (!clock.current.running) stopAll();
  }

  function record() {
    ensureAudio();
    setError(null);
    setDownload(null);
    const stream = canvas.current!.captureStream(30);
    audio.current!.dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    const types = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];
    const mimeType = types.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
    if (!mimeType) { setError("Este navegador não grava vídeo. Tente no Chrome ou no Safari atualizado."); return; }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: format === "v" ? 9_000_000 : 7_000_000 });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const slug = `${subject}-${script.tagline}`.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      setDownload({ url: URL.createObjectURL(blob), name: `filme-${slug}${format === "v" ? "-stories" : ""}.${ext}` });
    };
    recorder.current = rec;
    rec.start(1000);
    play(true);
    setState("recording");
  }

  const mins = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const fmt = FORMATS[format];
  const busy = state === "recording" || state === "loading";

  return (
    <div className="space-y-4">
      <div className={`mx-auto overflow-hidden rounded-3xl bg-ink shadow-[var(--shadow-soft)] ${format === "v" ? "max-w-[min(100%,24rem)]" : ""}`}>
        <canvas ref={canvas} width={fmt.w} height={fmt.h} className="block h-auto w-full" />
      </div>
      <button
        type="button"
        aria-label="Linha do tempo do filme"
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); }}
        className="block h-3 w-full cursor-pointer overflow-hidden rounded-full bg-rose-soft"
      >
        <span className="block h-full bg-rose-deep" style={{ width: `${progress * 100}%` }} />
      </button>
      <div className="flex flex-wrap items-center gap-3">
        {state === "loading" && <p className="text-taupe">Preparando fotos, vozes e vídeos… {Math.round(loaded * 100)}%</p>}
        {(state === "ready" || state === "paused" || state === "done") && (
          <button type="button" onClick={() => play(state !== "paused")} className="h-12 rounded-full bg-rose-deep px-7 font-semibold text-white">
            ▶ {state === "paused" ? "Continuar" : "Assistir"}
          </button>
        )}
        {state === "playing" && (
          <button type="button" onClick={pause} className="h-12 rounded-full border border-rose/70 bg-paper px-7 font-semibold text-rose-deep">❚❚ Pausar</button>
        )}
        {!busy && state !== "playing" && (
          <button type="button" onClick={record} className="h-12 rounded-full border border-rose/70 bg-paper px-6 font-semibold text-rose-deep">
            ⬇ Baixar o filme ({mins(total)})
          </button>
        )}
        {state === "recording" && <p className="font-semibold text-rose-deep">● Gravando… deixe esta aba aberta até o fim ({mins(total)}).</p>}
        {download && (
          <a href={download.url} download={download.name} className="h-12 content-center rounded-full bg-sage px-6 font-semibold text-white">Salvar arquivo ✓</a>
        )}
        <div className="ml-auto flex items-center gap-1 rounded-full bg-rose-soft p-1 text-sm">
          {(Object.keys(FORMATS) as Format[]).map((k) => (
            <button
              key={k}
              type="button"
              disabled={busy || state === "playing"}
              onClick={() => setFormat(k)}
              className={`rounded-full px-3 py-1.5 font-semibold ${format === k ? "bg-paper text-rose-deep shadow-sm" : "text-taupe"}`}
            >
              {FORMATS[k].label}
            </button>
          ))}
        </div>
        <span className="text-sm text-taupe">{mins(progress * total)} / {mins(total)}</span>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
