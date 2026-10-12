import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { EmailLinkForm } from "@/components/auth/email-form";
import { requestLoginLink } from "@/features/auth/actions";
import { safeNextPath } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next, erro } = await searchParams;
  return (
    <div className="mx-auto mt-6 max-w-md">
      <h1 className="text-center text-6xl">Que bom ter você aqui</h1>
      <p className="mt-3 text-center text-taupe">Entre com o e-mail que os pais da Maya cadastraram.</p>
      <Card className="mt-8 p-6">
        {erro === "link" && (
          <div className="mb-4">
            <Alert tone="warn" title="Este link expirou ou já foi usado.">
              Peça um novo link abaixo.
            </Alert>
          </div>
        )}
        <EmailLinkForm action={requestLoginLink} hidden={{ next: safeNextPath(next) }} />
      </Card>
    </div>
  );
}
