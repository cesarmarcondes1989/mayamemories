"use client";

import { useActionState } from "react";
import { dismissEmailPrompt, saveMyEmail, type EmailState } from "@/features/account/actions";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";

/** Convite gentil (e opcional) para deixar um e-mail depois de entrar pelo ursinho. */
export function EmailOptIn({ pendingEmail, dismissible = true, className }: { pendingEmail?: string | null; dismissible?: boolean; className?: string }) {
  const [state, action] = useActionState<EmailState, FormData>(saveMyEmail, { ok: false });
  const sentTo = state.ok ? state.sentTo : pendingEmail;

  return (
    <div className={cn("rounded-[var(--radius-card)] border border-rose/60 bg-rose-soft/60 p-5", className)}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-paper text-xl">✉️</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Quer deixar seu e-mail? <span className="font-normal text-taupe">(opcional)</span></p>
          <p className="text-sm text-taupe">Para entrar por outro celular e saber quando sua memória for aprovada. Nada de spam.</p>
        </div>
      </div>
      {sentTo ? (
        <p className="mt-3 text-sm">
          Enviamos um link para <strong>{sentTo}</strong>. Toque nele para confirmar ♡
        </p>
      ) : (
        <>
          <form action={action} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input name="email" type="email" required autoComplete="email" inputMode="email" placeholder="seu@email.com" className="flex-1" aria-label="Seu e-mail" />
            <SubmitButton pendingText="Enviando…">Salvar</SubmitButton>
          </form>
          {state.error && <div className="mt-2"><Alert tone="error">{state.error}</Alert></div>}
          {dismissible && (
            <form action={dismissEmailPrompt} className="mt-1 text-right">
              <button type="submit" className="text-sm text-taupe underline-offset-4 hover:underline">Agora não</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
