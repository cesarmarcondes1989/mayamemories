import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { qrSvg } from "@/lib/qr";
import { Logo } from "@/components/ui/misc";
import { PrintButton } from "@/components/tokens/print-button";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Imprimir QR" };
export const dynamic = "force-dynamic";

type Row = {
  public_id: string;
  label: string | null;
  status: string;
  person: { display_name: string } | null;
  event: { name: string; event_date: string | null; description: string | null } | null;
};

/** Cartão para imprimir: plaquinha de mesa (evento) ou cartão pessoal. */
export default async function PrintTokenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { vault } = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("nfc_tokens")
    .select("public_id, label, status, person:people(display_name), event:vault_events(name, event_date, description)")
    .eq("id", id)
    .eq("vault_id", vault.id)
    .maybeSingle();
  const token = data as unknown as Row | null;
  if (!token || ["revoked", "replaced"].includes(token.status)) notFound();

  const svg = await qrSvg(`${publicEnv.siteUrl()}/m/${token.public_id}`);
  const isTable = !token.person && Boolean(token.event);
  const title = isTable ? token.event!.name : (token.person?.display_name ?? token.label ?? vault.title);

  return (
    <div className="min-h-dvh bg-cream px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-6 flex max-w-md justify-between gap-3 print:hidden">
        <p className="text-sm text-taupe">Dica: imprima em papel grosso, tamanho A6 ou meia folha.</p>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-md rounded-[2rem] border-2 border-rose bg-white p-8 text-center print:border print:shadow-none">
        <Logo className="mx-auto size-12" />
        <p className="mt-2 text-sm font-semibold tracking-wide text-taupe uppercase">{vault.title}</p>
        <h1 className="mt-1 text-6xl leading-none text-rose-deep">{title}</h1>
        {isTable && token.event!.event_date && <p className="mt-1 text-taupe">{formatDate(token.event!.event_date)}</p>}
        <div className="mx-auto mt-6 size-64" dangerouslySetInnerHTML={{ __html: svg }} />
        {isTable ? (
          <>
            <p className="mt-6 font-display text-4xl">Aponte a câmera 📸</p>
            <p className="mt-1 text-[15px] text-ink/80">
              {token.event!.description ?? "Diga seu nome e deixe fotos, vídeos e recados deste dia. Sem cadastro, sem senha."}
            </p>
          </>
        ) : (
          <>
            <p className="mt-6 font-display text-4xl">Sua chave do baú ♡</p>
            <p className="mt-1 text-[15px] text-ink/80">Aponte a câmera e entre direto. Guarde com carinho: este QR é só seu.</p>
          </>
        )}
      </article>
    </div>
  );
}
