"use client";

import { useActionState, useRef, useState } from "react";
import { signUp, type SignupState } from "@/features/signup/actions";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";
import { track } from "@/components/analytics/client";

type Rel = { key: string; label: string };

export function SignupForm({
  relationshipTypes,
  defaultKind = "child",
  plan,
}: {
  relationshipTypes: Rel[];
  defaultKind?: "child" | "event";
  plan?: { key: string; name: string } | null;
}) {
  const [state, action] = useActionState<SignupState, FormData>(signUp, { status: "idle" });
  const f = state.fields ?? {};
  const [kind, setKind] = useState<"child" | "event">((f.kind as "child" | "event") ?? defaultKind);
  const [born, setBorn] = useState(f.expectedBirthDate ? "no" : "yes");
  const [startedAt] = useState(() => String(Date.now()));
  const started = useRef(false);

  if (state.status === "exists") {
    return (
      <div className="py-4 text-center">
        <p className="text-5xl">💌</p>
        <h2 className="mt-2 text-4xl">Você já tem conta!</h2>
        <p className="mx-auto mt-2 max-w-sm text-[15px] text-taupe">
          Enviamos um link de acesso para <strong className="text-ink">{state.message}</strong>. Abra no celular e você entra direto.
        </p>
      </div>
    );
  }

  return (
    <form
      action={action}
      onFocus={() => {
        if (!started.current) {
          started.current = true;
          track("signup_start");
        }
      }}
      className="space-y-5"
    >
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <input type="hidden" name="startedAt" value={startedAt} />
      {plan && <input type="hidden" name="plano" value={plan.key} />}
      {plan && (
        <Alert tone="info">
          Você começa agora no <strong>Grátis</strong>, com tudo funcionando. A gente fala com você para ativar o plano{" "}
          <strong>{plan.name}</strong> — nada se perde na troca.
        </Alert>
      )}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">O baú é para…</legend>
        <div className="grid grid-cols-2 gap-2">
          {([["child", "🧸", "Uma criança"], ["event", "💍", "Um evento"]] as const).map(([k, icon, label]) => (
            <label key={k} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border bg-paper p-4", kind === k ? "border-rose-deep ring-2 ring-rose/50" : "border-line")}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              <span aria-hidden="true" className="text-2xl">{icon}</span>
              <span className="font-semibold">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={kind === "child" ? "Nome da criança" : "Nome do evento"} htmlFor="subjectName" className={kind === "event" ? "sm:col-span-2" : undefined}>
          <Input id="subjectName" name="subjectName" required maxLength={80} placeholder={kind === "child" ? "Alice" : "Casamento Ana & Leo"} defaultValue={f.subjectName} />
        </Field>
        {kind === "child" ? (
          <>
            <Field label="É menina ou menino?" htmlFor="gender" optional hint="Só ajusta os textos (da/do).">
              <Select id="gender" name="gender" defaultValue={f.gender ?? "unspecified"}>
                <option value="girl">Menina</option>
                <option value="boy">Menino</option>
                <option value="unspecified">Prefiro não dizer / surpresa</option>
              </Select>
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-sm font-medium">Já nasceu?</legend>
              <div className="flex gap-2">
                {[["yes", "Já nasceu"], ["no", "Está a caminho"]].map(([v, label]) => (
                  <label key={v} className={cn("flex-1 cursor-pointer rounded-2xl border px-3 py-2.5 text-center text-[15px]", born === v ? "border-rose-deep bg-rose-soft font-semibold" : "border-line bg-paper")}>
                    <input type="radio" checked={born === v} onChange={() => setBorn(v)} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label={born === "yes" ? "Data de nascimento" : "Data prevista"} htmlFor="childDate" className="sm:col-span-2">
              <Input
                key={born}
                id="childDate"
                name={born === "yes" ? "birthDate" : "expectedBirthDate"}
                type="date"
                required
                defaultValue={born === "yes" ? f.birthDate : f.expectedBirthDate}
              />
            </Field>
          </>
        ) : (
          <Field label="Data do evento" htmlFor="eventDate" className="sm:col-span-2">
            <Input id="eventDate" name="eventDate" type="date" required defaultValue={f.eventDate} />
          </Field>
        )}
        <Field label="Seu nome" htmlFor="myName">
          <Input id="myName" name="myName" required maxLength={120} autoComplete="name" defaultValue={f.myName} />
        </Field>
        <Field label={kind === "child" ? "Você é…" : "Você é…"} htmlFor="relationship">
          <Select id="relationship" name="relationship" defaultValue={f.relationship ?? (kind === "child" ? "mae" : "outro")}>
            {relationshipTypes.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Seu e-mail" htmlFor="email" hint="Para entrar de outro celular. Nada de spam." className="sm:col-span-2">
          <Input id="email" name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={f.email} />
        </Field>
      </div>

      <Checkbox
        name="terms"
        required
        label={<>Li e aceito a <a href="/privacidade" target="_blank" className="underline">privacidade e os termos</a>.</>}
        hint="Você pode exportar ou apagar tudo quando quiser."
      />
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <SubmitButton size="lg" className="w-full" pendingText="Criando seu baú…">
        Criar meu baú grátis ♡
      </SubmitButton>
    </form>
  );
}
