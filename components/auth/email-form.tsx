"use client";
import { useActionState } from "react";
import type { LoginState } from "@/features/auth/actions";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/misc";

export function EmailLinkForm({
  action,
  hidden = {},
  submitLabel = "Receber link de acesso",
  sentMessage = "Se o seu e-mail estiver autorizado, você receberá um link de acesso em instantes. Abra-o neste mesmo celular.",
}: {
  action: (prev: LoginState, formData: FormData) => Promise<LoginState>;
  hidden?: Record<string, string>;
  submitLabel?: string;
  sentMessage?: string;
}) {
  const [state, formAction] = useActionState(action, { status: "idle" });
  if (state.status === "sent") {
    return (
      <Alert tone="success" title="Confira sua caixa de entrada ✉️">
        {sentMessage}
      </Alert>
    );
  }
  return (
    <form action={formAction} className="space-y-4">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Field label="Seu e-mail" htmlFor="email" hint="Enviaremos um link. Não é preciso criar senha.">
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="voce@email.com" />
      </Field>
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <SubmitButton size="lg" className="w-full" pendingText="Enviando link…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
