import type { Metadata } from "next";
import { requireMember } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "@/features/memories/profile-actions";
import { setConsent } from "@/features/memories/consent-actions";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Perfil" };

const CONSENT_LABELS: Record<string, string> = {
  contribution_terms: "Termo de contribuição",
  email_notifications: "E-mails de notificação",
  image_of_third_parties: "Imagens de terceiros",
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ salvo?: string }> }) {
  const viewer = await requireMember({ needsConsent: false });
  const { salvo } = await searchParams;
  const supabase = await createClient();
  const [{ data: prefs }, { data: consents }] = await Promise.all([
    supabase.from("notification_preferences").select("*").eq("profile_id", viewer.profileId!).maybeSingle(),
    supabase.from("consents").select("consent_type, status, policy_version, created_at").eq("person_id", viewer.personId!).order("created_at", { ascending: false }),
  ]);
  const latest = new Map<string, { status: string; created_at: string; policy_version: string }>();
  for (const c of consents ?? []) if (!latest.has(c.consent_type)) latest.set(c.consent_type, c);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader title="Seu perfil" description={viewer.email ?? undefined} />
      {salvo && <Alert tone="success">Preferências salvas.</Alert>}
      <Card className="p-6">
        <form action={updateProfile} className="space-y-4">
          <Field label="Como você quer ser chamado" htmlFor="displayName">
            <Input id="displayName" name="displayName" defaultValue={viewer.displayName} maxLength={120} required />
          </Field>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Notificações</legend>
            <Checkbox name="reviewed" defaultChecked={prefs?.on_contribution_reviewed ?? true} label="Quando minhas contribuições forem revisadas" />
            <Checkbox name="capsules" defaultChecked={prefs?.on_capsule_opening ?? true} label="Quando uma cápsula estiver perto de abrir" />
            <Checkbox name="digest" defaultChecked={prefs?.on_new_memories_digest ?? false} label="Resumo de novas memórias" />
            <Checkbox name="reminders" defaultChecked={prefs?.gentle_reminders ?? false} label="Lembretes gentis para contribuir" hint="Desligado por padrão. Sem pressão." />
          </fieldset>
          <SubmitButton variant="secondary">Salvar</SubmitButton>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-2xl">Consentimentos</h2>
        <p className="mb-4 text-sm text-taupe">Cada consentimento tem uma finalidade. Você pode retirar a qualquer momento.</p>
        <ul className="divide-y divide-line">
          {Object.entries(CONSENT_LABELS).map(([type, label]) => {
            const c = latest.get(type);
            const granted = c?.status === "granted";
            return (
              <li key={type} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-[15px]">{label}</p>
                  <p className="text-xs text-taupe">{c ? `${granted ? "Concedido" : "Retirado"} em ${formatDateTime(c.created_at)} · v${c.policy_version}` : "Não informado"}</p>
                </div>
                <form action={setConsent} className="flex items-center gap-2">
                  <Badge tone={granted ? "ok" : "neutral"}>{granted ? "Ativo" : "Inativo"}</Badge>
                  <input type="hidden" name="type" value={type} />
                  <input type="hidden" name="status" value={granted ? "withdrawn" : "granted"} />
                  <Button size="sm" variant="ghost" type="submit">
                    {granted ? "Retirar" : "Conceder"}
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-sm text-taupe">
          Retirar o termo de contribuição impede novos envios. Para excluir o que já foi enviado, use “Pedir exclusão” em cada memória.
        </p>
      </Card>

      <form action="/auth/sair" method="post">
        <Button variant="ghost" type="submit">
          Sair da conta
        </Button>
      </form>
    </div>
  );
}
