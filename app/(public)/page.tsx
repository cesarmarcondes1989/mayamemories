import type { Metadata } from "next";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { TrackView, TrackedLink } from "@/components/analytics/tracker";
import { Card } from "@/components/ui/card";
import { HeartDivider, HeartDoodle, SparkleDoodle } from "@/components/ui/doodles";
import { LeadForm } from "@/components/landing/lead-form";
import { getBrand, getPublicPlans } from "@/features/plans/queries";
import { priceLabel, whatsappLink, type Plan } from "@/lib/plans";
import { cn } from "@/components/ui/cn";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    title: { absolute: `${brand.brand_name} — memórias de família para descobrir no tempo certo` },
    description: brand.brand_slogan,
    // A vitrine pode aparecer no Google; o resto do site continua fora.
    robots: { index: true, follow: true },
  };
}

const STEPS = [
  { icon: "📦", title: "Você cria o baú", text: "Em 3 minutos: o nome, a data (de nascimento, de chegada ou da festa) e a cor do baú." },
  { icon: "🧸", title: "A família entra", text: "Cada pessoa recebe um ursinho NFC ou um link. Encostou o celular, entrou. Sem senha, sem cadastro chato." },
  { icon: "💌", title: "Todo mundo guarda", text: "Fotos, vídeos, áudios, cartas e visitas. Você aprova o que entra e tudo vira uma linha do tempo." },
  { icon: "🔓", title: "No tempo certo, abre", text: "Cartas trancadas até os 18 anos, cápsulas que abrem no aniversário. O banco não deixa abrir antes." },
];

const INSIDE = [
  ["📸", "Fotos e vídeos", "Do ultrassom ao primeiro passo"],
  ["🎙️", "Áudios", "A voz da vó cantando, guardada pra sempre"],
  ["✉️", "Cartas para o futuro", "Escritas hoje, lidas aos 18"],
  ["⏳", "Cápsulas do tempo", "Abrem sozinhas na data marcada"],
  ["🏠", "Visitas", "Quem foi, quando foi, o que levou"],
  ["🗓️", "Linha do tempo", "A história inteira, em ordem"],
  ["🛡️", "Moderação", "Nada aparece sem você aprovar"],
  ["💾", "Exportação", "Baixe tudo quando quiser. É de vocês."],
];

const FAQ = [
  ["Quem consegue ver as memórias?", "Só quem você convidou. Não existe perfil público, feed, curtida ou anúncio. Nem a nossa equipe abre o conteúdo das famílias."],
  ["Como funciona o ursinho NFC?", "Cada ursinho tem uma etiqueta que é a identidade de uma pessoa. Encostou o celular, ela entra direto no baú — sem senha. Perdeu? Você desativa na hora e manda outro."],
  ["Precisa instalar aplicativo?", "Não. Funciona no navegador do celular e do computador, iPhone ou Android."],
  ["E as cartas trancadas, abrem mesmo só na data?", "Sim. A trava fica no banco de dados, não só na tela. Nem quem escreveu consegue espiar antes."],
  ["Dá para criar eventos dentro do baú?", "Dá! Chá bar, 1 ano, batizado: você dá o nome, cria um token de mesa e os convidados encostam o celular, dizem o nome e mandam fotos e recados. Eles veem só o álbum daquele evento — o resto do baú continua da família."],
  ["Serve para casamento ou chá de bebê?", "Serve! No plano Evento, os convidados mandam fotos e recados pelo QR ou NFC da mesa, e no final vocês recebem o filme e o álbum da festa."],
  ["Se eu parar de pagar, perco tudo?", "Não. O baú fica guardado em modo leitura e você pode exportar tudo a qualquer momento."],
  ["Como eu pago?", "Pix, cartão ou boleto, pelo Mercado Pago. Enquanto estamos com as primeiras famílias, a gente fecha tudo com você pelo WhatsApp."],
];

function PlanCard({ plan }: { plan: Plan }) {
  const price = priceLabel(plan);
  return (
    <Card
      className={cn(
        "relative flex flex-col p-6",
        plan.highlight && "border-rose-deep/60 ring-2 ring-rose-deep/30 lg:-translate-y-2",
      )}
    >
      {plan.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rose-deep px-3 py-1 text-xs font-bold whitespace-nowrap text-white">
          ♡ o mais escolhido
        </span>
      )}
      <p className="text-xs font-bold tracking-[0.16em] text-taupe uppercase">
        {plan.audience === "event" ? "Evento" : plan.audience === "child" ? "Criança" : "Para começar"}
      </p>
      <h3 className="mt-1 text-5xl">{plan.name}</h3>
      {plan.tagline && <p className="mt-1 min-h-10 text-sm text-taupe">{plan.tagline}</p>}
      <div className="mt-4">
        <span className="text-3xl font-bold text-rose-deep">{price.main}</span>
        {price.suffix && <span className="ml-1 text-sm text-taupe">{price.suffix}</span>}
        {price.note && <p className="text-sm text-taupe">{price.note}</p>}
      </div>
      <ul className="mt-5 flex-1 space-y-2 text-[15px]">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden="true" className="text-rose-deep">♡</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <TrackedLink
        href={`/?plano=${plan.key}#quero`}
        event="plan_click"
        plan={plan.key}
        className={buttonClasses(plan.highlight ? "primary" : "secondary", "md", "mt-6 w-full")}
      >
        {plan.billing === "free" ? "Começar grátis" : `Quero o ${plan.name}`}
      </TrackedLink>
    </Card>
  );
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const [{ plano }, brand, plans] = await Promise.all([searchParams, getBrand(), getPublicPlans()]);
  const childPlans = plans.filter((p) => p.audience !== "event");
  const eventPlans = plans.filter((p) => p.audience === "event");

  return (
    <div className="space-y-24 sm:space-y-32">
      {/* ------------------------------------------------------------ hero */}
      <section className="grid items-center gap-12 pt-6 lg:grid-cols-[1.15fr_1fr] lg:pt-12">
        <div className="relative text-center lg:text-left">
          <SparkleDoodle className="absolute -top-8 left-0 size-9 text-rose-deep/70" />
          <h1 className="text-6xl leading-[0.95] sm:text-8xl">
            Um dia, quem você ama vai descobrir <span className="text-rose-deep">quem estava lá</span>
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-ink/80 lg:mx-0">
            Um baú digital e privado onde a família inteira guarda <strong className="text-rose-deep">fotos, vozes e cartas</strong> —
            para uma criança descobrir ao longo da vida, ou para uma festa nunca ser esquecida.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <TrackedLink href="#quero" event="cta_click" className={buttonClasses("primary", "lg", "px-9")}>
              Quero o meu baú ♡
            </TrackedLink>
            <ButtonLink href="#planos" size="lg" variant="secondary" className="px-9">
              Ver planos
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-taupe">Sem app para instalar · sem anúncios · só quem você convidar</p>
        </div>

        {/* Um pedacinho do produto */}
        <div className="relative mx-auto w-full max-w-sm" aria-hidden="true">
          <HeartDoodle className="absolute -top-6 -right-3 size-14 rotate-12 text-rose-deep/70" />
          <div className="rotate-2 rounded-[2.5rem] border-8 border-ink/85 bg-cream p-4 shadow-[var(--shadow-soft)]">
            <p className="text-center font-display text-3xl">Baú da Alice</p>
            <div className="mt-3 rounded-3xl bg-paper p-4 shadow-[var(--shadow-soft)]">
              <p className="text-xs font-bold tracking-wider text-taupe uppercase">Carta da vó Lúcia</p>
              <p className="mt-2 font-hand text-2xl leading-tight">
                Alice, hoje você fez dois meses e segurou meu dedo a tarde inteira…
              </p>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-3xl bg-rose-soft p-4">
              <span className="grid size-11 place-items-center rounded-2xl bg-paper text-xl">🔒</span>
              <span className="text-sm leading-tight">
                <strong className="block">Carta do papai</strong>abre em 12/05/2044 · aos 18 anos
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-3xl bg-paper p-4">
              <span className="grid size-11 place-items-center rounded-2xl bg-rose-soft text-xl">🎙️</span>
              <span className="text-sm leading-tight">
                <strong className="block">Tio Beto cantando</strong>áudio · 0:42
              </span>
            </div>
          </div>
          <div className="absolute -bottom-6 -left-4 -rotate-6 rounded-3xl bg-paper px-4 py-3 shadow-[var(--shadow-soft)]">
            <span className="text-3xl">🧸</span>
            <span className="ml-2 align-middle text-sm font-semibold">encostou, entrou</span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- por que existe */}
      <section className="mx-auto max-w-3xl text-center">
        <p className="font-hand text-3xl leading-snug text-ink/90 sm:text-4xl">
          As fotos estão espalhadas em 14 celulares. Os áudios da bisa, num grupo que ninguém acha mais.
          E a carta que você ia escrever… ainda não escreveu.
        </p>
        <HeartDivider className="mx-auto mt-8 max-w-xs" />
        <p className="mt-6 text-lg text-taupe">
          O {brand.brand_name} junta tudo num lugar só — e guarda até a hora certa.
        </p>
      </section>

      {/* -------------------------------------------------- como funciona */}
      <section id="como-funciona" className="scroll-mt-8">
        <h2 className="text-center text-5xl sm:text-6xl">Como funciona</h2>
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-[var(--radius-card)] bg-paper/80 p-6 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-2xl bg-rose-soft text-2xl" aria-hidden="true">
                  {s.icon}
                </span>
                <span className="font-display text-4xl text-rose-deep">{i + 1}</span>
              </div>
              <h3 className="mt-4 text-3xl">{s.title}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-taupe">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* -------------------------------------------------------- para quem */}
      <section className="grid gap-5 md:grid-cols-2">
        <Card className="p-7">
          <span className="text-4xl" aria-hidden="true">🧸</span>
          <h2 className="mt-2 text-5xl">Para uma criança</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-taupe">
            Da gestação aos 18 anos. Avós, tios, padrinhos e amigos guardando memórias que ela vai descobrir aos poucos —
            no primeiro aniversário, aos 15, aos 18. E dá para abrir eventos dentro do baú — o chá bar, o 1 ano — com token de mesa para os convidados.
          </p>
          <p className="mt-4 text-sm font-semibold text-rose-deep">Grátis · Ninho · Família · Legado</p>
        </Card>
        <Card className="p-7">
          <span className="text-4xl" aria-hidden="true">💍</span>
          <h2 className="mt-2 text-5xl">Para um evento</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-taupe">
            Casamento, chá de bebê, 15 anos, bodas. Os convidados encostam o celular na mesa e mandam fotos, vídeos e recados
            de voz. Nada de grupo de WhatsApp lotado — e no final vem o filme da festa.
          </p>
          <p className="mt-4 text-sm font-semibold text-rose-deep">Plano Evento · pagamento único</p>
        </Card>
      </section>

      {/* ------------------------------------------------------ o que cabe */}
      <section>
        <h2 className="text-center text-5xl sm:text-6xl">O que cabe no baú</h2>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {INSIDE.map(([icon, title, text]) => (
            <div key={title} className="rounded-3xl bg-paper/80 p-4 shadow-[var(--shadow-soft)]">
              <span className="text-2xl" aria-hidden="true">{icon}</span>
              <p className="mt-2 font-semibold text-rose-deep">{title}</p>
              <p className="text-sm leading-snug text-taupe">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- diferenciais */}
      <section className="rounded-[2.5rem] bg-rose-soft/70 px-6 py-12 sm:px-12">
        <h2 className="text-center text-5xl sm:text-6xl">Não é mais uma rede social</h2>
        <div className="mt-8 grid gap-6 text-center sm:grid-cols-3">
          {[
            ["🔒", "Privado de verdade", "Sem feed, sem curtidas, sem anúncio. Cada arquivo é protegido e só abre para quem foi convidado."],
            ["⏳", "Paciente", "Feito para durar 18 anos, não 24 horas. As memórias esperam a hora certa."],
            ["🎁", "É de vocês", "Exporte tudo quando quiser. No Legado, vira filme, livro e pendrive."],
          ].map(([icon, title, text]) => (
            <div key={title}>
              <span className="text-4xl" aria-hidden="true">{icon}</span>
              <h3 className="mt-2 text-3xl">{title}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-ink/75">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ planos */}
      <section id="planos" className="scroll-mt-8">
        <TrackView event="plans_view" targetId="planos" />
        <h2 className="text-center text-5xl sm:text-6xl">Planos</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-taupe">
          Comece de graça. Quando a família toda estiver lá dentro, você escolhe o plano que cabe na história de vocês.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {childPlans.map((p) => (
            <PlanCard key={p.key} plan={p} />
          ))}
        </div>
        {eventPlans.length > 0 && (
          <div className="mx-auto mt-10 grid max-w-3xl items-center gap-6 md:grid-cols-[1fr_1.1fr]">
            <div className="text-center md:text-left">
              <p className="font-hand text-3xl text-rose-deep">E para a festa?</p>
              <p className="mt-1 text-taupe">
                Um baú só para o evento: convidados entram sem cadastro e tudo vira lembrança organizada.
              </p>
            </div>
            {eventPlans.map((p) => (
              <PlanCard key={p.key} plan={p} />
            ))}
          </div>
        )}
        <p className="mt-8 text-center text-sm text-taupe">Pagamento por Pix, cartão ou boleto via Mercado Pago. Cancele quando quiser.</p>
      </section>

      {/* ---------------------------------------------------------------- FAQ */}
      <section id="perguntas" className="mx-auto max-w-3xl scroll-mt-8">
        <h2 className="text-center text-5xl sm:text-6xl">Dúvidas</h2>
        <div className="mt-8 space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-3xl bg-paper/80 px-5 py-4 shadow-[var(--shadow-soft)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {q}
                <span aria-hidden="true" className="text-xl text-rose-deep transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[15px] leading-relaxed text-taupe">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- quero */}
      <section id="quero" className="mx-auto max-w-2xl scroll-mt-8">
        <Card className="relative p-6 sm:p-10">
          <HeartDoodle className="absolute -top-5 -right-3 size-12 rotate-12 text-rose-deep/70" />
          <h2 className="text-center text-5xl sm:text-6xl">Vamos montar o seu?</h2>
          <p className="mx-auto mt-2 mb-8 max-w-md text-center text-taupe">
            Estamos abrindo para as primeiras famílias. Deixe seu contato e a gente prepara o baú junto com você.
          </p>
          <LeadForm
            plans={plans.map(({ key, name, audience }) => ({ key, name, audience }))}
            defaultPlan={plano}
          />
          {brand.contact_whatsapp && (
            <p className="mt-6 text-center text-sm">
              Prefere conversar agora?{" "}
              <a
                href={whatsappLink(brand.contact_whatsapp, `Oi! Vi o ${brand.brand_name} e quero saber mais.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-rose-deep underline underline-offset-4"
              >
                Chama no WhatsApp
              </a>
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}
