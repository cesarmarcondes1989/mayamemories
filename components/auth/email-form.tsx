"use client";
import { useActionState } from "react";
import { verifyEmailCode, type LoginState } from "@/features/auth/actions";
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
      <div className="space-y-5">
        <Alert tone="success" title="Confira sua caixa de entrada ✉️">
          {sentMessage}
        </Alert>
        {state.email && <CodeForm email={state.email} next={state.next ?? "/inicio"} />}
      </div>
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

/** Alternativa ao link: o código de 6 dígitos do mesmo e-mail. */
function CodeForm({ email, next }: { email: string; next: string }) {
  const [state, formAction] = useActionState(verifyEmailCode, { status: "idle" });
  return (
    <form action={formAction} className="space-y-3 border-t border-rose/20 pt-5">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />
      <Field label="Ou digite o código do e-mail" htmlFor="code" hint="Útil se o link abrir em outro aparelho ou disser que expirou.">
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,12}"
          maxLength={12}
          required
          placeholder="123456"
          className="text-center text-2xl tracking-[0.4em]"
        />
      </Field>
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <SubmitButton size="lg" variant="secondary" className="w-full" pendingText="Conferindo…">
        Entrar com o código
      </SubmitButton>
    </form>
  );
}
