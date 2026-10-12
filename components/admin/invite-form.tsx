"use client";
import { useActionState } from "react";
import { createInvitation, type InviteResult } from "@/features/admin/actions";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/misc";
import { CopyButton } from "./copy-button";

export function InviteForm({ people, defaultPersonId }: { people: Array<{ id: string; display_name: string }>; defaultPersonId?: string }) {
  const [state, action] = useActionState<InviteResult, FormData>(createInvitation, { status: "idle" });
  return (
    <div className="space-y-4">
      {state.status === "created" && state.link && (
        <Alert tone="success" title={state.emailed ? "Convite criado e e-mail enviado." : "Convite criado."}>
          <p className="mb-2">Link de convite (aparece só agora — guardamos apenas um hash):</p>
          <code className="block rounded-lg bg-paper p-2 text-xs break-all">{state.link}</code>
          <div className="mt-2">
            <CopyButton text={state.link} label="Copiar link" />
          </div>
          <p className="mt-2 text-xs">Uso único, com expiração. Envie por um canal privado.</p>
        </Alert>
      )}
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <form action={action} className="space-y-4">
        <Field label="Pessoa" htmlFor="personId">
          <Select id="personId" name="personId" defaultValue={defaultPersonId} required>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="E-mail" htmlFor="email" optional hint="Com e-mail, só essa pessoa consegue aceitar o convite.">
          <Input id="email" name="email" type="email" />
        </Field>
        <Field label="Validade (dias)" htmlFor="expiresInDays">
          <Input id="expiresInDays" name="expiresInDays" type="number" min={1} max={365} defaultValue={30} />
        </Field>
        <Checkbox name="addToFamily" defaultChecked label="Incluir no grupo “Família autorizada”" hint="Permite ver memórias marcadas para a família." />
        <Checkbox name="sendEmail" defaultChecked label="Enviar o convite por e-mail agora" />
        <Checkbox name="nfc" label="Criar também um chaveiro NFC para esta pessoa" />
        <Input name="nfcLabel" placeholder="Nome do chaveiro (ex.: Ursinho da Vovó)" aria-label="Nome do chaveiro" />
        <SubmitButton>Criar convite</SubmitButton>
      </form>
    </div>
  );
}
