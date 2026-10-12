import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { CAPSULE_TYPE_LABELS, OPENING_RULE_LABELS } from "@/lib/constants";

type Capsule = {
  id?: string;
  title?: string;
  description?: string | null;
  theme?: string | null;
  capsule_type?: string;
  opening_rule?: string;
  opens_at?: string | null;
  visibility_policy?: string;
};

export function CapsuleForm({ action, capsule = {}, submitLabel }: { action: (fd: FormData) => Promise<void>; capsule?: Capsule; submitLabel: string }) {
  return (
    <form action={action} className="space-y-4">
      {capsule.id && <input type="hidden" name="id" value={capsule.id} />}
      <Field label="Nome" htmlFor="title">
        <Input id="title" name="title" required maxLength={200} defaultValue={capsule.title} />
      </Field>
      <Field label="Descrição" htmlFor="description" optional>
        <Textarea id="description" name="description" className="min-h-24" defaultValue={capsule.description ?? ""} />
      </Field>
      <Field label="Tema" htmlFor="theme" optional hint="Ex.: O que nos fazia rir; O que desejamos para você.">
        <Input id="theme" name="theme" defaultValue={capsule.theme ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo" htmlFor="capsuleType">
          <Select id="capsuleType" name="capsuleType" defaultValue={capsule.capsule_type ?? "special"}>
            {Object.entries(CAPSULE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quem poderá ver ao abrir" htmlFor="visibilityPolicy">
          <Select id="visibilityPolicy" name="visibilityPolicy" defaultValue={capsule.visibility_policy ?? "family"}>
            <option value="family">Família autorizada</option>
            <option value="selected">Participantes selecionados</option>
            <option value="admins">Somente os pais</option>
          </Select>
        </Field>
        <Field label="Condição de abertura" htmlFor="openingRule">
          <Select id="openingRule" name="openingRule" defaultValue={capsule.opening_rule ?? "date"}>
            {Object.entries(OPENING_RULE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data de abertura" htmlFor="opensAt" optional hint="Obrigatória para regras com data.">
          <Input id="opensAt" name="opensAt" type="date" defaultValue={capsule.opens_at?.slice(0, 10) ?? ""} />
        </Field>
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
