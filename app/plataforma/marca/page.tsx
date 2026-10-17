import { getBrand } from "@/features/plans/queries";
import { updateBrand } from "@/features/plans/actions";
import { Card } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata = { title: "Marca e contato" };

export default async function BrandPage({ searchParams }: { searchParams: Promise<{ erro?: string; salvo?: string }> }) {
  const sp = await searchParams;
  const brand = await getBrand();
  const { data: cfg } = await (await createClient()).from("app_settings").select("*").maybeSingle();
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Vitrine"
        title="Marca e contato"
        description="Nome provisório até você decidir a marca. Trocar aqui muda o site inteiro."
      />
      {sp.erro && <Alert tone="error">{sp.erro}</Alert>}
      {sp.salvo && <Alert tone="success">Salvo. Já está no ar.</Alert>}
      <Card className="p-6">
        <form action={updateBrand} className="grid gap-4">
          <Field label="Nome da marca" htmlFor="brand_name">
            <Input id="brand_name" name="brand_name" defaultValue={brand.brand_name} required maxLength={60} />
          </Field>
          <Field label="Slogan" htmlFor="brand_slogan" hint="Aparece no Google e quando alguém compartilha o link.">
            <Input id="brand_slogan" name="brand_slogan" defaultValue={brand.brand_slogan} maxLength={160} />
          </Field>
          <Field label="WhatsApp de vendas" htmlFor="contact_whatsapp" optional hint="Com DDD. Aparece como “Chama no WhatsApp” no site.">
            <Input id="contact_whatsapp" name="contact_whatsapp" type="tel" defaultValue={brand.contact_whatsapp ?? ""} placeholder="(11) 99999-9999" />
          </Field>
          <Field label="E-mail de contato" htmlFor="contact_email" optional>
            <Input id="contact_email" name="contact_email" type="email" defaultValue={brand.contact_email ?? ""} />
          </Field>
          <fieldset className="space-y-3 border-t border-line pt-4">
            <legend className="text-sm font-semibold">Cadastro pelo site</legend>
            <Checkbox
              name="self_service_vaults"
              defaultChecked={cfg?.self_service_vaults ?? true}
              label="Qualquer pessoa pode criar a conta e o baú sozinha"
              hint="Desligue para pausar novos cadastros (o formulário de interessados continua)."
            />
            <Field label="Baús por conta no autoatendimento" htmlFor="self_service_vault_limit" hint="O plano Grátis vem com 1.">
              <Input id="self_service_vault_limit" name="self_service_vault_limit" type="number" min={0} max={50} defaultValue={cfg?.self_service_vault_limit ?? 1} className="w-28" />
            </Field>
          </fieldset>
          <div>
            <SubmitButton pendingText="Salvando…">Salvar</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
