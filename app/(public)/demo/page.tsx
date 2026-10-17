import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { HeartDoodle } from "@/components/ui/doodles";

export const metadata: Metadata = {
  title: "Demonstração",
  description: "Passeie pelo Baú da Alice: fotos, vozes, cartas trancadas e cápsulas do tempo.",
  robots: { index: true, follow: true },
};

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ indisponivel?: string }> }) {
  const { indisponivel } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl pt-2 text-center">
      <HeartDoodle className="mx-auto size-12 text-rose-deep" />
      <h1 className="mt-2 text-6xl">Conheça o Baú da Alice</h1>
      <p className="mx-auto mt-3 max-w-md text-[15px] text-taupe">
        Uma família de mentirinha, com 5 meses de memórias: ultrassom, primeiro banho, a vó cantando, cartas trancadas até os 18…
        Passeie à vontade — nada que você fizer aqui é salvo.
      </p>
      {indisponivel && <div className="mt-6 text-left"><Alert tone="warn">A demonstração está sendo preparada. Tente de novo em instantes.</Alert></div>}
      <div className="mt-8 grid gap-4 text-left sm:grid-cols-2">
        <Card className="flex flex-col p-6">
          <span className="text-4xl" aria-hidden="true">👵</span>
          <h2 className="mt-2 text-4xl">Como família</h2>
          <p className="mt-1 flex-1 text-sm text-taupe">Veja o que avós, tios e padrinhos veem: linha do tempo, cápsulas, áudios e o que já pode ser aberto.</p>
          <a href="/demo/entrar?como=familia" className={buttonClasses("primary", "md", "mt-4")}>Entrar como família</a>
        </Card>
        <Card className="flex flex-col p-6">
          <span className="text-4xl" aria-hidden="true">🛠️</span>
          <h2 className="mt-2 text-4xl">Como mãe/pai</h2>
          <p className="mt-1 flex-1 text-sm text-taupe">O painel de quem cuida do baú: aprovar memórias, pessoas, ursinhos, eventos, QR codes e exportação.</p>
          <a href="/demo/entrar?como=admin" className={buttonClasses("secondary", "md", "mt-4")}>Entrar como administradora</a>
        </Card>
      </div>
      <p className="mt-8 text-sm text-taupe">
        Gostou? <Link href="/comecar" className="font-semibold text-rose-deep underline-offset-4 hover:underline">Crie o baú da sua família grátis</Link>
        {" · "}
        <Link href="/tutoriais" className="font-semibold text-rose-deep underline-offset-4 hover:underline">Ver tutoriais</Link>
      </p>
    </div>
  );
}
