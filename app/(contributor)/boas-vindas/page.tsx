import type { Metadata } from "next";
import { subjectWords } from "@/lib/subject";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/permissions/viewer";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/misc";
import { acceptTerms } from "@/features/memories/consent-actions";

export const metadata: Metadata = { title: "Boas-vindas" };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const viewer = await requireMember({ needsConsent: false });
  if (viewer.hasConsent) redirect("/inicio");
  const { erro } = await searchParams;
  return (
    <div className="mx-auto max-w-xl">
      <p className="text-xs font-medium tracking-[0.2em] text-rose-deep uppercase">Boas-vindas</p>
      <h1 className="mt-2 text-5xl leading-tight">Que bom ter você aqui, {viewer.displayName.split(" ")[0]}.</h1>
      <p className="mt-4 text-taupe">
        Antes de começar, um combinado rápido. Tudo o que você enviar fica privado até ser revisado por {subjectWords(viewer.vault).keepers},
        e você pode pedir correção ou exclusão quando quiser.
      </p>
      <Card className="mt-8 p-6">
        <form action={acceptTerms} className="space-y-3">
          <Checkbox
            name="terms"
            required
            label="Concordo que minhas contribuições sejam guardadas e exibidas conforme as regras de visibilidade, após revisão."
            hint="Necessário para contribuir. Você pode retirar este consentimento no seu perfil."
          />
          <Checkbox
            name="thirdParties"
            label="Vou enviar apenas fotos e vídeos de pessoas que autorizaram."
            hint="Imagens de terceiros exigem cuidado."
          />
          <Checkbox name="emails" label="Quero receber e-mails sobre minhas contribuições e cápsulas." hint="Sem lembretes insistentes. Nunca." />
          {erro && <Alert tone="error">Para continuar, aceite o primeiro item.</Alert>}
          <SubmitButton size="lg" className="mt-2 w-full">
            Começar
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
