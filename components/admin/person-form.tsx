import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function PersonForm({
  action,
  relationshipTypes,
  person,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  relationshipTypes: Array<{ key: string; label: string }>;
  person?: { id: string; display_name: string; relationship_type: string; notes: string | null };
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-4">
      {person && <input type="hidden" name="id" value={person.id} />}
      <Field label="Nome de exibição" htmlFor="displayName">
        <Input id="displayName" name="displayName" required maxLength={120} defaultValue={person?.display_name} placeholder="Vovó Lúcia" />
      </Field>
      <Field label="Relação com a Maya" htmlFor="relationshipType" hint="Os tipos podem ser editados nas configurações.">
        <Select id="relationshipType" name="relationshipType" defaultValue={person?.relationship_type ?? "outro"}>
          {relationshipTypes.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Observações internas" htmlFor="notes" optional>
        <Textarea id="notes" name="notes" className="min-h-20" maxLength={2000} defaultValue={person?.notes ?? ""} />
      </Field>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
