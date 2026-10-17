"use client";
import { useActionState, useState } from "react";
import { createVault, type CreateVaultState } from "@/features/vaults/actions";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";

const THEMES = [
  ["rosa", "Rosa"], ["azul", "Azul"], ["salvia", "Sálvia"], ["marronzinho", "Marronzinho"],
  ["lavanda", "Lavanda"], ["vermelho", "Vermelho"], ["amarelo", "Amarelo"], ["noite", "Noite"],
] as const;

export function CreateVaultForm({ relationshipTypes }: { relationshipTypes: Array<{ key: string; label: string }> }) {
  const [state, action] = useActionState<CreateVaultState, FormData>(createVault, { status: "idle" });
  const [kind, setKind] = useState<"child" | "event">("child");
  return (
    <form action={action} className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Para quem é o baú?</legend>
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
        <Field label={kind === "child" ? "Nome da criança" : "Nome do evento"} htmlFor="subjectName">
          <Input id="subjectName" name="subjectName" required maxLength={80} placeholder={kind === "child" ? "Maya" : "Ana & Leo"} />
        </Field>
        {kind === "child" ? (
          <>
            <Field label="Sexo" htmlFor="gender" optional hint="Só ajusta os textos (da/do).">
              <Select id="gender" name="gender" defaultValue="unspecified">
                <option value="girl">Menina</option>
                <option value="boy">Menino</option>
                <option value="unspecified">Prefiro não dizer</option>
              </Select>
            </Field>
            <Field label="Data de nascimento" htmlFor="birthDate" optional>
              <Input id="birthDate" name="birthDate" type="date" />
            </Field>
            <Field label="…ou data prevista" htmlFor="expectedBirthDate" optional>
              <Input id="expectedBirthDate" name="expectedBirthDate" type="date" />
            </Field>
          </>
        ) : (
          <Field label="Data do evento" htmlFor="eventDate">
            <Input id="eventDate" name="eventDate" type="date" required />
          </Field>
        )}
        <Field label="Seu nome" htmlFor="myName">
          <Input id="myName" name="myName" required maxLength={120} />
        </Field>
        <Field label="Sua relação" htmlFor="relationship">
          <Select id="relationship" name="relationship" defaultValue="outro">
            {relationshipTypes.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Tema de cores</legend>
        <div className="grid grid-cols-4 gap-2">
          {THEMES.map(([key, label], i) => (
            <label key={key} data-theme={key} className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border border-line bg-cream p-2 has-[:checked]:ring-2 has-[:checked]:ring-rose-deep">
              <input type="radio" name="theme" value={key} defaultChecked={i === 0} className="sr-only" />
              <span aria-hidden="true" className="size-7 rounded-full bg-rose-deep" />
              <span className="text-xs font-semibold text-ink">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <SubmitButton size="lg">Criar baú</SubmitButton>
    </form>
  );
}
