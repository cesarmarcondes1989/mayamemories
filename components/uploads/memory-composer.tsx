"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, ProgressBar } from "@/components/ui/misc";
import { Spinner } from "@/components/ui/spinner";
import { AudioRecorder } from "./audio-recorder";
import { readMediaDuration, uploadToSignedUrl } from "./upload-engine";
import { checkFileAgainstLimits, type UploadLimits } from "@/lib/storage/limits";
import { formatBytes } from "@/lib/format";
import type { SubjectWords } from "@/lib/subject";
import { VISIBILITY_OPTIONS, VISIT_TYPES } from "@/lib/constants";
import {
  createMemoryDraft,
  discardDraft,
  dropAsset,
  finalizeAsset,
  renewUploadUrl,
  submitMemory,
  type UploadTicket,
} from "@/features/memories/actions";

export type ComposerKind = "photo" | "audio" | "text" | "letter" | "visit" | "drawing";

type Picked = { file: File; preview?: string; duration?: number; error?: string };
type Progress = { name: string; fraction: number; state: "waiting" | "uploading" | "verifying" | "done" | "failed"; error?: string };

export function MemoryComposer({
  kind,
  limits,
  today,
  letterMilestones = [],
  capsules = [],
  events = [],
  guestEventId = null,
  subject,
}: {
  subject: SubjectWords;
  kind: ComposerKind;
  limits: UploadLimits;
  today: string;
  letterMilestones?: Array<{ label: string; date: string }>;
  capsules?: Array<{ id: string; title: string }>;
  events?: Array<{ id: string; name: string }>;
  guestEventId?: string | null;
}) {
  const router = useRouter();
  const wantedEvent = useSearchParams().get("evento");
  const [eventId, setEventId] = useState(events.some((e) => e.id === wantedEvent) ? wantedEvent! : (guestEventId ?? ""));
  const [files, setFiles] = useState<Picked[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(kind === "letter" ? "" : today);
  const [visibility, setVisibility] = useState(kind === "letter" ? "family" : "family");
  const [recipient, setRecipient] = useState(subject.name);
  const [unlockChoice, setUnlockChoice] = useState(letterMilestones.at(-1)?.date ?? "custom");
  const [unlockCustom, setUnlockCustom] = useState("");
  const [capsuleId, setCapsuleId] = useState("");
  const [visitType, setVisitType] = useState("home");
  const [companions, setCompanions] = useState("");
  const [phase, setPhase] = useState<"form" | "sending" | "partial">("form");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const aborters = useRef<Record<string, () => void>>({});
  const draftId = useRef<string | null>(null);
  const tickets = useRef<UploadTicket[]>([]);

  useEffect(() => () => files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview)), [files]);

  const accept = useMemo(() => {
    if (kind === "audio") return limits.audio.mime.join(",");
    if (kind === "drawing") return limits.document.mime.join(",");
    if (kind === "photo") return [...limits.image.mime, ...limits.video.mime].join(",");
    return limits.image.mime.join(",");
  }, [kind, limits]);

  const limitText = useMemo(() => {
    const mb = (b: number) => `${Math.round(b / 1024 / 1024)} MB`;
    if (kind === "audio") return `Áudios até ${mb(limits.audio.max_bytes)} e ${Math.round((limits.audio.max_seconds ?? 0) / 60)} min.`;
    if (kind === "drawing") return `PDF ou imagem até ${mb(limits.document.max_bytes)}.`;
    if (kind === "photo")
      return `Fotos até ${mb(limits.image.max_bytes)}; vídeos até ${mb(limits.video.max_bytes)} e ${Math.round((limits.video.max_seconds ?? 0) / 60)} min. Até ${limits.max_files_per_memory} arquivos.`;
    return `Fotos até ${mb(limits.image.max_bytes)}.`;
  }, [kind, limits]);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const picked: Picked[] = [];
    for (const file of Array.from(list)) {
      const duration = await readMediaDuration(file);
      const check = checkFileAgainstLimits({ name: file.name, size: file.size, type: file.type, durationSeconds: duration }, limits, {
        preferDocument: kind === "drawing",
      });
      picked.push({
        file,
        duration,
        preview: file.type.startsWith("image/") || file.type.startsWith("video/") ? URL.createObjectURL(file) : undefined,
        error: check.ok ? undefined : check.error,
      });
    }
    setFiles((prev) => [...prev, ...picked].slice(0, limits.max_files_per_memory));
  }

  function removeFile(index: number) {
    setFiles((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return copy;
    });
  }

  const unlockAt = kind === "letter" ? (unlockChoice === "custom" ? unlockCustom : unlockChoice) : null;

  async function uploadOne(t: UploadTicket, file: File): Promise<boolean> {
    const setP = (p: Partial<Progress>) =>
      setProgress((prev) => ({ ...prev, [t.assetId]: { ...prev[t.assetId], ...p } as Progress }));
    let url = t.signedUrl;
    for (let attempt = 0; attempt < 3; attempt++) {
      setP({ state: "uploading", fraction: 0, error: undefined });
      const job = uploadToSignedUrl(url, file, (fraction) => setP({ fraction }));
      aborters.current[t.assetId] = job.abort;
      try {
        await job.promise;
        break;
      } catch (e) {
        if ((e as Error).message === "aborted") {
          setP({ state: "failed", error: "Envio cancelado." });
          return false;
        }
        if (attempt === 2) {
          setP({ state: "failed", error: "A conexão falhou. Verifique a internet e tente novamente." });
          return false;
        }
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        const renewed = await renewUploadUrl(t.assetId);
        if (renewed.ok) url = renewed.data.signedUrl;
      }
    }
    setP({ state: "verifying", fraction: 1 });
    const verified = await finalizeAsset(t.assetId);
    if (!verified.ok) {
      setP({ state: "failed", error: verified.error });
      return false;
    }
    setP({ state: "done" });
    return true;
  }

  async function runUploads(list: UploadTicket[]) {
    const results = [];
    for (const t of list) results.push(await uploadOne(t, files[t.fileIndex].file));
    return results.every(Boolean);
  }

  async function finish() {
    const res = await submitMemory(draftId.current!);
    if (!res.ok) {
      setError(res.error);
      setPhase("partial");
      return;
    }
    router.replace(`/obrigado?tipo=${kind}&m=${draftId.current}`);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (files.some((f) => f.error)) {
      setError("Remova os arquivos que não podem ser enviados.");
      return;
    }
    if (kind === "letter" && !unlockAt) {
      setError("Escolha quando a carta poderá ser aberta.");
      return;
    }
    setPhase("sending");
    const result = await createMemoryDraft({
      kind,
      title: title || undefined,
      description: description || undefined,
      occurredAt: kind === "visit" ? undefined : occurredAt || null,
      visibility: visibility as "family",
      recipient: kind === "letter" ? recipient : undefined,
      unlockAt: unlockAt || null,
      requestedCapsuleId: capsuleId || null,
      eventId: eventId || null,
      files: files.map((f) => ({ name: f.file.name, size: f.file.size, type: f.file.type, durationSeconds: f.duration })),
      visit: kind === "visit" ? { occurredAt, visitType: visitType as "home", companions: companions || undefined } : undefined,
    });
    if (!result.ok) {
      setError(result.error);
      setPhase("form");
      return;
    }
    draftId.current = result.data.memoryId;
    if (result.data.submitted) {
      router.replace(`/obrigado?tipo=${kind}&m=${result.data.memoryId}`);
      return;
    }
    tickets.current = result.data.uploads;
    setProgress(
      Object.fromEntries(
        result.data.uploads.map((t) => [t.assetId, { name: files[t.fileIndex].file.name, fraction: 0, state: "waiting" as const }]),
      ),
    );
    const allOk = await runUploads(result.data.uploads);
    if (allOk) await finish();
    else setPhase("partial");
  }

  async function retryFailed() {
    setPhase("sending");
    setError(null);
    const failed = tickets.current.filter((t) => progress[t.assetId]?.state === "failed");
    const renewed: UploadTicket[] = [];
    for (const t of failed) {
      const r = await renewUploadUrl(t.assetId);
      if (r.ok) renewed.push({ ...t, signedUrl: r.data.signedUrl });
      else await dropAsset(t.assetId); // verificação reprovou: o arquivo não pode ser usado
    }
    const ok = await runUploads(renewed);
    if (ok) await finish();
    else setPhase("partial");
  }

  async function sendWithoutFailed() {
    setPhase("sending");
    for (const t of tickets.current.filter((t) => progress[t.assetId]?.state === "failed")) await dropAsset(t.assetId);
    await finish();
  }

  async function cancelAll() {
    Object.values(aborters.current).forEach((abort) => abort());
    if (draftId.current) await discardDraft(draftId.current);
    draftId.current = null;
    setPhase("form");
    setProgress({});
  }

  const showFiles = kind === "photo" || kind === "drawing" || kind === "text" || kind === "visit" || kind === "audio";
  const sending = phase !== "form";

  if (sending) {
    const items = Object.entries(progress);
    return (
      <div className="space-y-4" aria-live="polite">
        <h2 className="text-3xl">{phase === "partial" ? "Alguns arquivos não foram enviados" : "Guardando com cuidado…"}</h2>
        {items.length === 0 && (
          <p className="flex items-center gap-2 text-taupe">
            <Spinner /> Preparando…
          </p>
        )}
        <ul className="space-y-3">
          {items.map(([id, p]) => (
            <li key={id} className="rounded-2xl border border-line bg-paper p-4">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-taupe">
                  {p.state === "uploading" && `${Math.round(p.fraction * 100)}%`}
                  {p.state === "verifying" && "Verificando…"}
                  {p.state === "done" && "✓ Recebido"}
                  {p.state === "waiting" && "Na fila"}
                  {p.state === "failed" && "Falhou"}
                </span>
              </div>
              <ProgressBar value={p.state === "done" ? 100 : p.fraction * 100} label={`Envio de ${p.name}`} />
              {p.error && <p className="mt-2 text-sm text-danger">{p.error}</p>}
            </li>
          ))}
        </ul>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex flex-wrap gap-2">
          {phase === "partial" && (
            <>
              <Button type="button" onClick={retryFailed}>
                Tentar novamente
              </Button>
              {items.some(([, p]) => p.state === "done") && (
                <Button type="button" variant="secondary" onClick={sendWithoutFailed}>
                  Enviar sem os que falharam
                </Button>
              )}
            </>
          )}
          <Button type="button" variant="ghost" onClick={cancelAll}>
            Cancelar envio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {kind === "audio" && (
        <AudioRecorder
          maxSeconds={limits.audio.max_seconds ?? 600}
          onRecorded={(file, seconds) =>
            setFiles(file ? [{ file, duration: seconds, error: seconds && seconds > (limits.audio.max_seconds ?? 1e9) ? "Gravação longa demais." : undefined }] : [])
          }
        />
      )}

      {kind === "visit" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data da visita" htmlFor="visit-date" hint="Pode corrigir se foi em outro dia.">
            <Input id="visit-date" type="date" max={today} required value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
          </Field>
          <Field label="Tipo de encontro" htmlFor="visit-type">
            <Select id="visit-type" value={visitType} onChange={(e) => setVisitType(e.target.value)}>
              {VISIT_TYPES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quem estava junto" htmlFor="companions" optional className="sm:col-span-2">
            <Input id="companions" value={companions} onChange={(e) => setCompanions(e.target.value)} placeholder="Ex.: Vovô Jorge e tia Bia" maxLength={500} />
          </Field>
        </div>
      )}

      {showFiles && (
        <div>
          <span className="mb-1.5 block text-sm font-medium">
            {kind === "audio" ? "…ou envie um arquivo de áudio" : kind === "drawing" ? "Desenho ou documento" : kind === "photo" ? "Fotos ou vídeos" : "Foto"}
            {(kind === "text" || kind === "visit") && <span className="ml-1 font-normal text-taupe">(opcional)</span>}
          </span>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-card)] border-2 border-dashed border-line bg-paper px-4 py-8 text-center transition hover:border-rose-deep/50">
            <span aria-hidden="true" className="mb-2 text-3xl">
              {kind === "audio" ? "🎧" : "＋"}
            </span>
            <span className="font-medium">Escolher do celular</span>
            <span className="mt-1 text-sm text-taupe">{limitText}</span>
            <input
              type="file"
              className="sr-only"
              accept={accept}
              multiple={kind === "photo" || kind === "drawing"}
              onChange={(e) => {
                if (kind === "audio" || kind === "text" || kind === "visit") setFiles([]);
                void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {files.length > 0 && kind !== "audio" && (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {files.map((f, i) => (
                <li key={i} className="relative overflow-hidden rounded-2xl border border-line bg-cream">
                  {f.preview && f.file.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.preview} alt="" className="aspect-square w-full object-cover" />
                  ) : f.preview && f.file.type.startsWith("video/") ? (
                    <video src={f.preview} className="aspect-square w-full object-cover" muted playsInline />
                  ) : (
                    <div className="grid aspect-square place-items-center p-2 text-center text-xs text-taupe">{f.file.name}</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-ink/50 px-2 py-1 text-[11px] text-paper">{formatBytes(f.file.size)}</div>
                  {f.error && <div className="absolute inset-0 grid place-items-center bg-danger/80 p-2 text-center text-[11px] text-paper">{f.error}</div>}
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-paper/90 text-sm shadow"
                    aria-label={`Remover ${f.file.name}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          {kind === "audio" && files[0] && !files[0].file.name.startsWith("mensagem-para-maya") && (
            <p className="mt-2 text-sm text-taupe">
              Arquivo escolhido: {files[0].file.name} ({formatBytes(files[0].file.size)}){" "}
              {files[0].error && <span className="text-danger">— {files[0].error}</span>}
            </p>
          )}
        </div>
      )}

      {kind === "letter" && (
        <Field label="Para quem é a carta" htmlFor="recipient">
          <Input id="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} maxLength={120} />
        </Field>
      )}

      <Field
        label={kind === "letter" ? "Título da carta" : kind === "photo" ? "Legenda" : "Título"}
        htmlFor="title"
        optional
      >
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={kind === "letter" ? "Para quando você fizer 15 anos" : ""} />
      </Field>

      <Field
        label={kind === "letter" ? "Sua carta" : kind === "visit" ? "Uma mensagem sobre esse encontro" : kind === "text" ? "Sua mensagem" : "Conte o contexto"}
        htmlFor="description"
        optional={kind !== "text" && kind !== "letter"}
        hint={kind === "text" ? "Uma lembrança que você gostaria que ela guardasse." : undefined}
      >
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={20000}
          required={kind === "letter" || (kind === "text" && files.length === 0)}
          className={kind === "letter" ? "letter-body min-h-72" : ""}
          placeholder={kind === "letter" ? `Querid${subject.pronoun === "ele" ? "o" : "a"} ${subject.name},` : ""}
        />
      </Field>

      {kind === "letter" ? (
        <Field label="Quando ela poderá abrir?" htmlFor="unlock" hint="A carta fica guardada e só pode ser lida a partir desta data — nem por link direto.">
          <Select id="unlock" value={unlockChoice} onChange={(e) => setUnlockChoice(e.target.value)}>
            {letterMilestones.map((m) => (
              <option key={m.label} value={m.date}>
                {m.label}
              </option>
            ))}
            <option value="custom">Escolher uma data</option>
          </Select>
          {unlockChoice === "custom" && (
            <Input className="mt-2" type="date" min={today} value={unlockCustom} onChange={(e) => setUnlockCustom(e.target.value)} required aria-label="Data de abertura" />
          )}
        </Field>
      ) : (
        kind !== "visit" && (
          <Field label="Quando aconteceu?" htmlFor="occurred" optional hint="A data do momento, não a do envio.">
            <Input id="occurred" type="date" max={today} value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
          </Field>
        )
      )}

      {events.length > 0 && (
        <Field label="É de algum evento?" htmlFor="event" optional hint={eventId ? "Vai para o álbum do evento." : undefined}>
          <Select id="event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {!guestEventId && <option value="">Não, é do dia a dia</option>}
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                🎉 {e.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <details className="rounded-2xl border border-line bg-paper p-4">
        <summary className="cursor-pointer text-[15px] font-medium">Quem poderá ver</summary>
        <div className="mt-4 space-y-2">
          {VISIBILITY_OPTIONS.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-start gap-3 rounded-xl p-2 has-[:checked]:bg-rose-soft/60">
              <input type="radio" name="visibility" value={o.value} checked={visibility === o.value} onChange={() => setVisibility(o.value)} className="mt-1 accent-[var(--rose-deep)]" />
              <span>
                <span className="block text-[15px]">{o.label}</span>
                <span className="block text-sm text-taupe">{o.hint}</span>
              </span>
            </label>
          ))}
          {capsules.length > 0 && (
            <Field label="Sugerir para uma cápsula" htmlFor="capsule" optional className="pt-2">
              <Select id="capsule" value={capsuleId} onChange={(e) => setCapsuleId(e.target.value)}>
                <option value="">Nenhuma</option>
                {capsules.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <p className="pt-1 text-sm text-taupe">{subject.keepers[0].toUpperCase() + subject.keepers.slice(1)} revisam tudo antes de qualquer pessoa ver.</p>
        </div>
      </details>

      {error && <Alert tone="error">{error}</Alert>}

      <p className="text-xs leading-relaxed text-taupe">
        Ao enviar, você concorda que esta lembrança seja guardada e mostrada conforme a visibilidade escolhida, depois da
        revisão de {subject.keepers}. Você pode pedir correção ou exclusão quando quiser.{" "}
        <a href="/privacidade" className="underline">Privacidade</a>
      </p>

      <Button type="submit" size="lg" className="w-full sm:w-auto">
        {kind === "visit" ? "Registrar visita" : kind === "letter" ? "Guardar carta" : "Enviar com carinho"}
      </Button>
    </form>
  );
}
