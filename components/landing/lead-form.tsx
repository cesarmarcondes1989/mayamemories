"use client";

import { useActionState, useState } from "react";
import { submitLead, type LeadState } from "@/features/plans/actions";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/misc";
import { HeartDoodle } from "@/components/ui/doodles";

type Option = { key: string; name: string; audience: string };

export function LeadForm({ plans, defaultPlan }: { plans: Option[]; defaultPlan?: string }) {
  const [state, action] = useActionState<LeadState, FormData>(submitLead, { ok: false });
  const initialPlan = plans.some((p) => p.key === defaultPlan) ? defaultPlan! : "";
  const [plan, setPlan] = useState(initialPlan);
  const [kind, setKind] = useState(plans.find((p) => p.key === initialPlan)?.audience === "event" ? "event" : "child");
  const f = state.fields ?? {};

  if (state.ok) {
    return (
      <div className="py-6 text-center">
        <HeartDoodle className="mx-auto size-14 text-rose-deep" />
        <h3 className="mt-3 text-4xl">Recebemos! ♡</h3>
        <p className="mx-auto mt-2 max-w-sm text-[15px] text-taupe">
          A gente fala com você em até um dia útil para montar o seu baú. Enquanto isso, vai separando aquela foto preferida.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {/* Armadilha para robôs: invisível para pessoas */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium">É para…</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["child", "🧸 Uma criança"],
            ["event", "💍 Um evento"],
          ].map(([value, label]) => (
            <label
              key={value}
              className="flex cursor-pointer items-center justify-center rounded-2xl border border-line bg-paper px-3 py-3 text-[15px] has-[:checked]:border-rose-deep has-[:checked]:bg-rose-soft has-[:checked]:font-semibold"
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Seu nome" htmlFor="lead-name">
        <Input id="lead-name" name="name" required maxLength={120} autoComplete="name" defaultValue={f.name} />
      </Field>
      <Field label="Plano" htmlFor="lead-plan" optional>
        <Select id="lead-plan" name="plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="">Ainda não sei</option>
          {plans.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="WhatsApp" htmlFor="lead-phone" hint="Com DDD">
        <Input id="lead-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" defaultValue={f.phone} />
      </Field>
      <Field label="E-mail" htmlFor="lead-email" optional>
        <Input id="lead-email" name="email" type="email" autoComplete="email" defaultValue={f.email} />
      </Field>
      <Field label={kind === "event" ? "Conta do evento" : "Conta um pouquinho"} htmlFor="lead-message" optional className="sm:col-span-2">
        <Textarea
          id="lead-message"
          name="message"
          maxLength={1000}
          className="min-h-24"
          placeholder={kind === "event" ? "Casamento em março, uns 150 convidados…" : "A Alice nasce em maio e a família toda mora longe…"}
          defaultValue={f.message}
        />
      </Field>
      {state.error && (
        <div className="sm:col-span-2">
          <Alert tone="error">{state.error}</Alert>
        </div>
      )}
      <div className="sm:col-span-2">
        <SubmitButton size="lg" className="w-full" pendingText="Enviando…">
          Quero o meu baú ♡
        </SubmitButton>
        <p className="mt-2 text-center text-xs text-taupe">Sem spam. Seus dados servem só para a gente responder você.</p>
      </div>
    </form>
  );
}
