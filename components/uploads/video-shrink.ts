"use client";

// Vídeos maiores que o limite do Storage são recomprimidos no próprio aparelho
// antes do envio: o vídeo toca escondido, cada quadro vai para um canvas e o
// MediaRecorder grava de novo em 720p com uma taxa que cabe no limite.
// Leva o tempo do vídeo (30 s de vídeo = ~30 s preparando).

/** Maior arquivo que o Storage aceita (Supabase Free = 50 MB). Ajuste com NEXT_PUBLIC_UPLOAD_MAX_MB. */
export const SERVER_MAX_BYTES = (Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_MB) || 50) * 1024 * 1024;

const OUTPUT_TYPES = ["video/mp4;codecs=avc1.42E01F,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

export function canShrinkVideo(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    OUTPUT_TYPES.some((t) => MediaRecorder.isTypeSupported(t))
  );
}

export type PrimedVideo = { el: HTMLVideoElement; url: string; audio: AudioContext | null; unlocked: Promise<void> };

/**
 * Chame DENTRO do toque do usuário (antes de qualquer await): o iPhone só deixa
 * tocar vídeo com som e ligar o áudio a partir de um gesto.
 */
export function primeVideo(file: File): PrimedVideo {
  const el = document.createElement("video");
  const url = URL.createObjectURL(file);
  el.src = url;
  el.playsInline = true;
  el.preload = "auto";
  el.setAttribute("playsinline", "");
  Object.assign(el.style, { position: "fixed", left: "0", top: "0", width: "2px", height: "2px", opacity: "0", pointerEvents: "none" });
  document.body.appendChild(el);
  let audio: AudioContext | null = null;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audio = new Ctx();
    void audio.resume();
  } catch {
    audio = null;
  }
  // Toca e pausa já: destrava o elemento para tocar de novo depois, fora do gesto
  const unlocked = el.play().then(() => el.pause(), () => {});
  return { el, url, audio, unlocked };
}

export function releaseVideo(p: PrimedVideo) {
  p.el.pause();
  p.el.remove();
  URL.revokeObjectURL(p.url);
  void p.audio?.close().catch(() => {});
}

function waitFor(el: HTMLMediaElement, event: string, ms = 15000) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("video_timeout")), ms);
    el.addEventListener(event, () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

export async function shrinkVideo(
  p: PrimedVideo,
  file: File,
  targetBytes: number,
  onProgress: (fraction: number) => void,
): Promise<File> {
  const { el } = p;
  await p.unlocked;
  if (el.readyState < 2) await waitFor(el, "loadeddata");
  const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 60;
  el.pause();
  el.currentTime = 0;

  const scale = Math.min(1, 1280 / Math.max(el.videoWidth || 1280, el.videoHeight || 720));
  const W = Math.max(2, Math.round(((el.videoWidth || 1280) * scale) / 2) * 2);
  const H = Math.max(2, Math.round(((el.videoHeight || 720) * scale) / 2) * 2);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const stream = canvas.captureStream(30);

  if (p.audio) {
    try {
      const src = p.audio.createMediaElementSource(el);
      const dest = p.audio.createMediaStreamDestination();
      src.connect(dest); // só para a gravação, sem sair no alto-falante
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      await p.audio.resume();
    } catch {
      el.muted = true; // sem WebAudio: segue sem som em vez de falhar
    }
  } else el.muted = true;

  // Taxa para caber no limite com folga de 12%
  const audioBps = 96_000;
  const videoBps = Math.max(400_000, Math.min(3_500_000, (targetBytes * 8 * 0.88) / duration - audioBps));
  const mimeType = OUTPUT_TYPES.find((t) => MediaRecorder.isTypeSupported(t))!;
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: Math.round(videoBps), audioBitsPerSecond: audioBps });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

  let running = true;
  const draw = () => {
    if (!running) return;
    ctx.drawImage(el, 0, 0, W, H);
    onProgress(Math.min(0.99, el.currentTime / duration));
    if ("requestVideoFrameCallback" in el) (el as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void }).requestVideoFrameCallback(draw);
    else requestAnimationFrame(draw);
  };

  ctx.drawImage(el, 0, 0, W, H);
  recorder.start(1000);
  const ended = waitFor(el, "ended", (duration + 30) * 1000);
  await el.play();
  draw();
  try {
    await ended;
  } finally {
    running = false;
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
  }

  const type = mimeType.split(";")[0];
  const blob = new Blob(chunks, { type });
  if (!blob.size) throw new Error("shrink_empty");
  if (blob.size > targetBytes) throw new Error("shrink_too_big");
  onProgress(1);
  const name = file.name.replace(/\.[^.]+$/, "") + (type === "video/mp4" ? ".mp4" : ".webm");
  return new File([blob], name, { type, lastModified: file.lastModified });
}
