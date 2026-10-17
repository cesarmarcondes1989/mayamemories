import Link from "next/link";

/** Faixa fixa para quem está navegando na demonstração. */
export function DemoBanner() {
  return (
    <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink px-4 py-2 text-center text-sm text-paper">
      <span>✨ Você está numa <strong>demonstração</strong>: pode clicar em tudo, nada é salvo.</span>
      <Link href="/comecar" className="rounded-full bg-rose-deep px-3 py-0.5 font-semibold text-white">Criar meu baú grátis</Link>
      <Link href="/demo" className="underline underline-offset-4">trocar de visão</Link>
    </div>
  );
}
