"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";

function pickMime(): string {
  // MP4/AAC primeiro: toca em iPhone, Android e computador. WebM só como reserva.
  const candidates = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return "";
}

function format(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Gravar → ouvir a prévia → regravar ou confirmar. */
export function AudioRecorder({ maxSeconds, onRecorded }: { maxSeconds: number; onRecorded: (file: File | null, seconds?: number) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "recorded" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(0);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = (rec.mimeType || mime || "audio/webm").split(";")[0];
        const blob = new Blob(chunks.current, { type });
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const seconds = (Date.now() - started.current) / 1000;
        const file = new File([blob], `mensagem-para-maya.${ext}`, { type });
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setState("recorded");
        onRecorded(file, seconds);
      };
      recorder.current = rec;
      rec.start(1000);
      started.current = Date.now();
      setElapsed(0);
      setState("recording");
      timer.current = setInterval(() => {
        const s = (Date.now() - started.current) / 1000;
        setElapsed(s);
        if (s >= maxSeconds) stop();
      }, 250);
    } catch {
      setState("error");
      setError("Não conseguimos acessar o microfone. Verifique a permissão do navegador ou envie um arquivo de áudio.");
    }
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setElapsed(0);
    setState("idle");
    onRecorded(null);
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-paper p-5 text-center">
      {state === "recording" ? (
        <>
          <div className="mx-auto mb-3 grid size-20 place-items-center rounded-full bg-rose-soft">
            <span className="size-6 animate-pulse rounded-full bg-rose-deep" aria-hidden="true" />
          </div>
          <p className="font-display text-3xl tabular-nums" aria-live="polite">
            {format(elapsed)}
          </p>
          <p className="mb-4 text-sm text-taupe">Gravando… (até {format(maxSeconds)})</p>
          <Button type="button" onClick={stop} size="lg">
            Parar gravação
          </Button>
        </>
      ) : state === "recorded" && previewUrl ? (
        <>
          <p className="mb-3 text-sm text-taupe">Ouça antes de enviar:</p>
          <audio controls src={previewUrl} className="w-full" />
          <div className="mt-4 flex justify-center gap-2">
            <Button type="button" variant="secondary" onClick={reset}>
              Regravar
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mx-auto mb-4 max-w-xs text-[15px] text-taupe">O que você gostaria que ela soubesse no futuro?</p>
          <Button type="button" onClick={start} size="lg">
            🎙️ Começar a gravar
          </Button>
          {error && (
            <div className="mt-4 text-left">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
        </>
      )}
    </div>
  );
}
