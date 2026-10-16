import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/features/settings/queries";
import { addRelationshipType, updateSettings } from "@/features/admin/actions";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ salvo?: string; erro?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const supabase = await createClient();
  const [{ data: rel }, { data: jobs }] = await Promise.all([
    supabase.from("relationship_types").select("key, label, active").order("sort_order"),
    supabase.from("notification_jobs").select("id, event_type, status, attempts, last_error, created_at").order("created_at", { ascending: false }).limit(15),
  ]);
  const mb = (b: number) => Math.round(b / 1024 / 1024);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader eyebrow="Projeto" title="Configurações" />
      {sp.salvo && <Alert tone="success">Configurações salvas.</Alert>}
      {sp.erro && <Alert tone="error">{sp.erro}</Alert>}
      <Card className="p-6">
        <form action={updateSettings} className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2">
            <h2 className="text-2xl sm:col-span-2">Identidade e datas</h2>
            <Field label="Nome do projeto" htmlFor="projectTitle">
              <Input id="projectTitle" name="projectTitle" defaultValue={s.project_title} />
            </Field>
            <Field label="Nome da criança" htmlFor="subjectName">
              <Input id="subjectName" name="subjectName" defaultValue={s.subject_name} />
            </Field>
            <Field label="Data prevista do nascimento" htmlFor="expectedBirthDate" optional>
              <Input id="expectedBirthDate" name="expectedBirthDate" type="date" defaultValue={s.expected_birth_date ?? ""} />
            </Field>
            <Field label="Data de nascimento" htmlFor="birthDate" optional hint="Usada para marcos e cartas “quando ela fizer X anos”.">
              <Input id="birthDate" name="birthDate" type="date" defaultValue={s.birth_date ?? ""} />
            </Field>
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
        <form action={addRelationshipType} className="mt-4 flex gap-2">
          <Input name="label" placeholder="Ex.: Madrinha" aria-label="Novo tipo" required />
          <SubmitButton variant="secondary">Adicionar</SubmitButton>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-2xl">Automações (n8n)</h2>
        <p className="mt-1 text-[15px] text-taupe">
          O n8n consome a fila de notificações por endpoints autenticados. A autorização de abertura de cápsulas permanece no banco. Veja docs/automations.md.
        </p>
        <ul className="mt-3 divide-y divide-line text-sm">
          {(jobs ?? []).map((j) => (
            <li key={j.id} className="flex justify-between gap-2 py-2">
              <span>
                <code>{j.event_type}</code> {j.last_error && <span className="text-danger">· {j.last_error}</span>}
              </span>
              <span className="text-taupe">
                {j.status} · {j.attempts}x · {formatDateTime(j.created_at)}
              </span>
            </li>
          ))}
          {(jobs ?? []).length === 0 && <li className="py-2 text-taupe">Nenhuma notificação na fila.</li>}
        </ul>
      </Card>
    </div>
  );
}
