import { getAllPlans } from "@/features/plans/queries";
import { updatePlan } from "@/features/plans/actions";
import { Card } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { priceLabel } from "@/lib/plans";

export const metadata = { title: "Planos e preços" };

const money = (cents: number | null) => (cents == null ? "" : (cents / 100).toFixed(2).replace(".", ","));

export default async function PlansAdminPage({ searchParams }: { searchParams: Promise<{ erro?: string; salvo?: string }> }) {
  const sp = await searchParams;
  const plans = await getAllPlans();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vitrine"
        title="Planos e preços"
        description="O que você salvar aqui aparece na hora no site. Preço em branco mostra “Sob consulta / Fale com a gente”."
      />
      {sp.erro && <Alert tone="error">{sp.erro}</Alert>}
      {sp.salvo && <Alert tone="success">Plano “{sp.salvo}” salvo.</Alert>}
      {plans.map((p) => {
        const price = priceLabel(p);
        return (
          <Card key={p.key} className="p-5 sm:p-6">
            <form action={updatePlan} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="key" value={p.key} />
              <div className="flex flex-wrap items-baseline justify-between gap-2 sm:col-span-2">
                <h2 className="text-4xl">{p.name}</h2>
                <p className="text-sm text-taupe">
                  No site: <strong className="text-rose-deep">{price.main}</strong> {price.suffix} {price.note && `· ${price.note}`}
                </p>
              </div>
              <Field label="Nome" htmlFor={`name-${p.key}`}>
                <Input id={`name-${p.key}`} name="name" defaultValue={p.name} required maxLength={60} />
              </Field>
              <Field label="Cobrança" htmlFor={`billing-${p.key}`}>
                <Select id={`billing-${p.key}`} name="billing" defaultValue={p.billing}>
                  <option value="free">Grátis</option>
                  <option value="subscription">Assinatura (mensal/anual)</option>
                  <option value="one_time">Pagamento único</option>
                </Select>
              </Field>
              <Field label="Frase curta" htmlFor={`tagline-${p.key}`} className="sm:col-span-2">
                <Input id={`tagline-${p.key}`} name="tagline" defaultValue={p.tagline ?? ""} maxLength={160} />
              </Field>
              <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                <Field label="R$ por mês" htmlFor={`m-${p.key}`}>
                  <Input id={`m-${p.key}`} name="price_monthly" inputMode="decimal" defaultValue={money(p.price_monthly_cents)} placeholder="29,90" />
                </Field>
                <Field label="R$ por ano" htmlFor={`y-${p.key}`}>
                  <Input id={`y-${p.key}`} name="price_yearly" inputMode="decimal" defaultValue={money(p.price_yearly_cents)} placeholder="299,00" />
                </Field>
                <Field label="R$ único" htmlFor={`o-${p.key}`}>
                  <Input id={`o-${p.key}`} name="price_once" inputMode="decimal" defaultValue={money(p.price_once_cents)} placeholder="1.290,00" />
                </Field>
              </div>
              <Field label="O que inclui (uma linha por item)" htmlFor={`f-${p.key}`} className="sm:col-span-2">
                <Textarea id={`f-${p.key}`} name="features" defaultValue={p.features.join("\n")} className="min-h-32" />
              </Field>
              <Field label="Ordem no site" htmlFor={`s-${p.key}`}>
                <Input id={`s-${p.key}`} name="sort_order" type="number" defaultValue={p.sort_order} />
              </Field>
              <div className="grid gap-2">
                <Checkbox name="active" defaultChecked={p.active} label="Aparece no site" />
                <Checkbox name="highlight" defaultChecked={p.highlight} label="Destacar como “o mais escolhido”" />
              </div>
              <div className="sm:col-span-2">
                <SubmitButton pendingText="Salvando…">Salvar {p.name}</SubmitButton>
              </div>
            </form>
          </Card>
        );
      })}
    </div>
  );
}
