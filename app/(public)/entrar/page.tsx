import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { EmailLinkForm } from "@/components/auth/email-form";
import { requestLoginLink } from "@/features/auth/actions";
import { safeNextPath } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next, erro } = await searchParams;
  // Links antigos podem trazer o erro do Supabase dentro do "next"
  const linkError = erro === "link" || /error_code=/.test(next ?? "");
  const target = /error_code=/.test(next ?? "") ? safeNextPath(next).split("?")[0] : safeNextPath(next);
  return (
    <div className="mx-auto mt-6 max-w-md">
      <h1 className="text-center text-6xl">Que bom ter você aqui</h1>
      <p className="mt-3 text-center text-taupe">Entre com o seu e-mail. Mandamos um link de acesso.</p>
      <Card className="mt-8 p-6">
        {linkError && (
          <div className="mb-4">
            <Alert tone="warn" title="Este link expirou ou já foi usado.">
              Isso acontece quando ele passa do prazo, quando você pede outro link depois dele ou quando o
              app de e-mail “abre” o link sozinho. Peça um novo abaixo — agora também dá para entrar pelo código de 6 dígitos.
            </Alert>
          </div>
        )}
        <EmailLinkForm action={requestLoginLink} hidden={{ next: target }} />
      </Card>
      <p className="mt-6 text-center text-sm text-taupe">
        Ainda não tem um baú?{" "}
        <Link href="/comecar" className="font-semibold text-rose-deep underline-offset-4 hover:underline">Crie grátis</Link>
      </p>
    </div>
  );
}
