import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/permissions/viewer";
import { getSettings } from "@/features/settings/queries";
import { addRelationshipType, updateSettings } from "@/features/admin/actions";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Configurações" };

const THEME_OPTIONS = [
  { key: "rosa", label: "Rosa" },
  { key: "azul", label: "Azul" },
  { key: "salvia", label: "Sálvia" },
  { key: "marronzinho", label: "Marronzinho" },
  { key: "lavanda", label: "Lavanda" },
  { key: "vermelho", label: "Vermelho" },
  { key: "amarelo", label: "Amarelo" },
  { key: "noite", label: "Noite" },
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ salvo?: string; erro?: string }> }) {
  const sp = await searchParams;
  const viewer = await requireAdmin();
  const s = await getSettings();
  const supabase = await createClient();
  const { data: rel } = await supabase.from("relationship_types").select("key, label, active").order("sort_order");
  const mb = (b: number) => Math.round(b / 1024 / 1024);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader eyebrow="Baú" title="Configurações" />
      {sp.salvo && <Alert tone="success">Configurações salvas.</Alert>}
      {sp.erro && <Alert tone="error">{sp.erro}</Alert>}
      <Card className="p-6">
        <form action={updateSettings} className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2">
            <h2 className="text-2xl sm:col-span-2">O baú</h2>
            <Field label="Nome do baú" htmlFor="title" hint={`Endereço: /${viewer.vault.slug}`}>
              <Input id="title" name="title" defaultValue={s.title} maxLength={120} />
            </Field>
            <Field label={s.kind === "event" ? "Protagonistas" : "Nome da criança"} htmlFor="subjectName">
              <Input id="subjectName" name="subjectName" defaultValue={s.subject_name} maxLength={80} />
            </Field>
            {s.kind === "child" ? (
              <>
                <Field label="Data prevista do nascimento" htmlFor="expectedBirthDate" optional>
                  <Input id="expectedBirthDate" name="expectedBirthDate" type="date" defaultValue={s.expected_birth_date ?? ""} />
                </Field>
                <Field label="Data de nascimento" htmlFor="birthDate" optional hint="Usada para marcos e cartas “quando fizer X anos”.">
                  <Input id="birthDate" name="birthDate" type="date" defaultValue={s.birth_date ?? ""} />
                </Field>
                <Field label="Sexo" htmlFor="gender" optional hint="Só ajusta os textos (da/do).">
                  <Select id="gender" name="gender" defaultValue={viewer.vault.gender ?? "unspecified"}>
                    <option value="girl">Menina</option>
                    <option value="boy">Menino</option>
                    <option value="unspecified">Prefiro não dizer</option>
                  </Select>
                </Field>
              </>
            ) : (
              <Field label="Data do evento" htmlFor="eventDate">
                <Input id="eventDate" name="eventDate" type="date" defaultValue={s.event_date ?? ""} />
              </Field>
            )}
            <Field label="Mensagem de boas-vindas" htmlFor="welcome" optional className="sm:col-span-2">
              <Input id="welcome" name="welcome" defaultValue={s.welcome_message ?? ""} maxLength={400} placeholder="Um cantinho para guardar o que vivemos juntos." />
            </Field>
          </section>
          <section>
            <h2 className="mb-3 text-2xl">Tema de cores</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {THEME_OPTIONS.map((t) => (
                <label key={t.key} data-theme={t.key} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-paper p-3 has-[:checked]:ring-2 has-[:checked]:ring-rose-deep">
                  <input type="radio" name="theme" value={t.key} defaultChecked={s.theme === t.key} className="sr-only" />
                  <span aria-hidden="true" className="size-8 shrink-0 rounded-full border border-line bg-rose-deep" />
                  <span className="text-sm font-semibold text-ink">{t.label}</span>
                </label>
              ))}
            </div>
          </section>
          <section className="grid gap-4 sm:grid-cols-3">
            <h2 className="text-2xl sm:col-span-3">Limites de arquivos</h2>
            <Field label="Foto (MB)" htmlFor="imageMb"><Input id="imageMb" name="imageMb" type="number" min={1} defaultValue={mb(s.limits.image.max_bytes)} /></Field>
            <Field label="Vídeo (MB)" htmlFor="videoMb"><Input id="videoMb" name="videoMb" type="number" min={1} defaultValue={mb(s.limits.video.max_bytes)} /></Field>
            <Field label="Vídeo (min)" htmlFor="videoMin"><Input id="videoMin" name="videoMin" type="number" min={1} defaultValue={Math.round((s.limits.video.max_seconds ?? 600) / 60)} /></Field>
            <Field label="Áudio (MB)" htmlFor="audioMb"><Input id="audioMb" name="audioMb" type="number" min={1} defaultValue={mb(s.limits.audio.max_bytes)} /></Field>
            <Field label="Áudio (min)" htmlFor="audioMin"><Input id="audioMin" name="audioMin" type="number" min={1} defaultValue={Math.round((s.limits.audio.max_seconds ?? 900) / 60)} /></Field>
            <Field label="Documento (MB)" htmlFor="documentMb"><Input id="documentMb" name="documentMb" type="number" min={1} defaultValue={mb(s.limits.document.max_bytes)} /></Field>
            <Field label="Arquivos por memória" htmlFor="maxFiles"><Input id="maxFiles" name="maxFiles" type="number" min={1} max={50} defaultValue={s.limits.max_files_per_memory} /></Field>
            <Field label="Espaço por pessoa (GB)" htmlFor="quotaGb"><Input id="quotaGb" name="quotaGb" type="number" min={1} step="0.5" defaultValue={s.limits.max_bytes_per_person / 1024 ** 3} /></Field>
            <p className="text-sm text-taupe sm:col-span-3">
              O limite global do Supabase Storage também se aplica (plano Free: 50 MB por arquivo). Ajuste em Storage → Settings.
            </p>
          </section>
          <section>
            <h2 className="text-2xl">Incentivos na página inicial</h2>
            <label className="mt-2 flex items-center gap-2 text-[15px]">
              <input type="checkbox" name="nudgesEnabled" defaultChecked={s.nudges_enabled} className="size-5 accent-[var(--rose-deep)]" />
              Mostrar números da própria pessoa e mensagens carinhosas (“faz 12 dias da sua última foto…”). Sem ranking.
            </label>
          </section>
          <section>
            <h2 className="text-2xl">Regras de aprovação</h2>
            <p className="mt-1 text-[15px] text-taupe">Nesta versão, toda contribuição e todo comentário passam por aprovação. Conteúdo público está desativado.</p>
          </section>
          <SubmitButton>Salvar configurações</SubmitButton>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-2xl">Tipos de relacionamento</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(rel ?? []).map((r) => (
            <Badge key={r.key}>{r.label}</Badge>
          ))}
        </div>
        {viewer.isPlatformAdmin && (
        <form action={addRelationshipType} className="mt-4 flex gap-2">
          <Input name="label" placeholder="Ex.: Madrinha" aria-label="Novo tipo" required />
          <SubmitButton variant="secondary">Adicionar</SubmitButton>
        </form>
        )}
      </Card>

    </div>
  );
}
