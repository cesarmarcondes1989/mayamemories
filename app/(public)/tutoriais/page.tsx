import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { TUTORIALS } from "@/lib/tutorials";

export const metadata: Metadata = {
  title: "Tutoriais",
  description: "Aprenda a usar o Guardei pra você em minutos: ursinho, cartas para o futuro, eventos e exportação.",
  robots: { index: true, follow: true },
};

export default function TutorialsPage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-6xl">Tutoriais</h1>
        <p className="mx-auto mt-2 max-w-lg text-taupe">
          Tudo gravado no Baú da Alice, nossa família de demonstração. Assista e depois experimente lá — nada que você fizer é salvo.
        </p>
      </div>
      {(["família", "mãe/pai"] as const).map((who) => (
        <section key={who}>
          <h2 className="mb-4 text-4xl">{who === "família" ? "Para a família" : "Para quem cuida do baú"}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {TUTORIALS.filter((t) => t.who === who).map((t) => (
              <Card key={t.slug} id={t.slug} className="flex scroll-mt-8 flex-col p-5">
                {t.video ? (
                  <video controls preload="none" playsInline poster="/demo/capa.jpg" className="mb-4 aspect-[9/16] max-h-[520px] w-full rounded-2xl bg-cream object-contain">
                    <source src={`/tutoriais/${t.video}`} type="video/mp4" />
                  </video>
                ) : null}
                <p className="text-3xl" aria-hidden="true">{t.icon}</p>
                <h3 className="mt-1 text-3xl">{t.title}</h3>
                <p className="text-sm text-taupe">{t.summary}</p>
                <ol className="mt-3 flex-1 list-decimal space-y-1.5 pl-5 text-[15px]">
                  {t.steps.map((s) => <li key={s}>{s}</li>)}
                </ol>
                <a href={`/demo/entrar?como=${t.tryAt.como}`} className={buttonClasses("secondary", "sm", "mt-4 self-start")}>
                  Experimentar na demo →
                </a>
              </Card>
            ))}
          </div>
        </section>
      ))}
      <p className="text-center text-sm text-taupe">
        Ficou alguma dúvida? <Link href="/#perguntas" className="font-semibold text-rose-deep underline-offset-4 hover:underline">Perguntas frequentes</Link>
      </p>
    </div>
  );
}
