import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { saveStoryGuidance } from "@/features/story/actions";
import { Card } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Checkbox, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClasses } from "@/components/ui/button";
import type { StoryRules } from "@/features/story/curate";

export const metadata: Metadata = { title: "Livro e filme" };
export const maxDuration = 60;

export default async function StoryAdminPage({ searchParams }: { searchParams: Promise<{ salvo?: string; erro?: string }> }) {
  const { vault } = await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: settings }, { data: v }, { data: sels }] = await Promise.all([
    supabase.from("story_settings").select("guidance, rules").eq("vault_id", vault.id).maybeSingle(),
    supabase.from("vaults").select("ai_enabled").eq("id", vault.id).maybeSingle(),
    supabase.from("story_selections").select("period, kind, rationale, method, updated_at").eq("vault_id", vault.id).order("period", { ascending: false }),
  ]);
  const rules = (settings?.rules ?? {}) as Partial<StoryRules>;
  const year = new Date().getFullYear();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Presente de cada ano"
        title="Livro e filme"
        description="Tudo é montado sozinho: a escolha das memórias, a ordem, os textos e a diagramação. Você não precisa fazer nada — só, se quiser, dizer o que é importante."
        actions={
          <>
            <Link href={`/livro/${year}`} className={buttonClasses("primary", "sm")}>📖 Livro de {year}</Link>
            <Link href={`/filme/${year}`} className={buttonClasses("secondary", "sm")}>🎬 Filme de {year}</Link>
          </>
        }
      />
      {sp.salvo && <Alert tone="success">Salvo. Na próxima vez que alguém abrir o livro ou o filme, ele já vem com as novas regras.</Alert>}
      {sp.erro && <Alert tone="error">{sp.erro}</Alert>}

      <Card className="p-6">
        <h2 className="text-3xl">O que é importante para vocês?</h2>
        <p className="mt-1 text-sm text-taupe">
          Escreva do seu jeito. Ex.: “A tia Rosa faleceu e era muito importante para o Mattheo, quero ela em destaque.” ou
          “Não coloque nada do tio Carlos.” Só administradores do baú veem este texto.
        </p>
        <form action={saveStoryGuidance} className="mt-4 space-y-4">
          <Textarea name="guidance" defaultValue={settings?.guidance ?? ""} maxLength={2000} className="min-h-32" placeholder="Conte aqui o que priorizar ou deixar de fora…" />
          <Checkbox
            name="ai_enabled"
            defaultChecked={v?.ai_enabled ?? true}
            label="Usar IA para escolher as memórias e escrever os textos"
            hint="Só títulos, descrições, autores e datas são enviados (nunca fotos ou áudios). Desligado, usamos textos-modelo e uma escolha automática simples."
          />
          <SubmitButton pendingText="Entendendo o pedido…">Salvar</SubmitButton>
        </form>
        {(rules.exclude?.length || rules.prioritize?.length || rules.notes) ? (
          <div className="mt-5 rounded-2xl bg-cream p-4 text-sm">
            <p className="font-semibold">O que entendemos:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {rules.exclude?.map((e) => <li key={e.person_id}>Deixar de fora tudo o que foi guardado por <strong>{e.name}</strong>.</li>)}
              {rules.prioritize?.map((p) => <li key={p.person_id}>Dar destaque a <strong>{p.name}</strong>{p.weight > 1 ? " (muito)" : ""}.</li>)}
              {rules.notes && <li>{rules.notes}</li>}
            </ul>
          </div>
        ) : null}
      </Card>

      <Card className="p-6">
        <h2 className="text-3xl">Como escolhemos</h2>
        <p className="mt-1 text-[15px] text-taupe">
          Quando há mais memórias do que cabem (80 no livro, 30 no filme), um conselho de IAs no papel das pessoas mais presentes
          deste baú — e da criança aos 18 anos — dá notas a cada lembrança. Depois equilibramos: todos os meses aparecem e ninguém
          domina. Suas orientações acima sempre valem por cima de tudo.
        </p>
        {(sels ?? []).length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {(sels ?? []).map((s) => (
              <li key={`${s.period}-${s.kind}`} className="rounded-2xl bg-cream px-4 py-3">
                <strong>{s.kind === "book" ? "📖 Livro" : "🎬 Filme"} {s.period}</strong> — {s.rationale ?? "escolhendo agora…"}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
