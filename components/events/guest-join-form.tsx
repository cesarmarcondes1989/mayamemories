"use client";

import { useActionState } from "react";
import { joinEventAsGuest, type JoinState } from "@/features/events/guest";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/misc";

export function GuestJoinForm({ token, defaultName }: { token: string; defaultName?: string }) {
  const [state, action] = useActionState<JoinState, FormData>(joinEventAsGuest.bind(null, token), {});
  return (
    <form action={action} className="space-y-4">
      <Field label="Como você se chama?" htmlFor="guest-name" hint="É assim que seu nome aparece nas memórias.">
        <Input id="guest-name" name="name" required maxLength={60} autoComplete="name" defaultValue={defaultName} placeholder="Tia Bia" />
      </Field>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <SubmitButton size="lg" className="w-full" pendingText="Entrando…">
        Entrar na festa 🎉
      </SubmitButton>
      <p className="text-center text-xs text-taupe">
        Sem cadastro e sem senha. Ao entrar você concorda com a <a href="/privacidade" className="underline">privacidade</a> do baú.
      </p>
    </form>
  );
}
