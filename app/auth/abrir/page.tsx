import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { confirmEmailLink } from "./actions";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default async function OpenLinkPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string; next?: string }> }) {
  const { token_hash = "", type = "email", next = "" } = await searchParams;
  return (
    <div className="mx-auto mt-16 max-w-md px-4 text-center">
      <p className="text-3xl italic text-rose-deep">guardei pra você ♡</p>
      <h1 className="mt-4 text-5xl">Tudo pronto</h1>
      <p className="mt-3 text-taupe">Toque no botão para entrar.</p>
      <Card className="mt-8 p-6">
        <form action={confirmEmailLink}>
          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next} />
          <SubmitButton size="lg" className="w-full" pendingText="Entrando…">
            Entrar
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
