import { HeartDivider, HeartDoodle, SparkleDoodle } from "@/components/ui/doodles";
import Link from "next/link";

const ACTIONS = [
  { href: "/visitas/nova", icon: "🏡", title: "Registrar minha visita", text: "Conte que esteve com a Maya." },
  { href: "/enviar/foto", icon: "📷", title: "Enviar uma foto ou vídeo", text: "Um momento que merece ficar guardado." },
  { href: "/enviar/audio", icon: "🎙️", title: "Gravar uma mensagem", text: "Sua voz, para ela ouvir quando crescer." },
  { href: "/cartas/nova", icon: "✉️", title: "Escrever uma carta para o futuro", text: "Ela será aberta na data que você escolher." },
  { href: "/enviar/mensagem", icon: "✍️", title: "Escrever uma mensagem", text: "Uma lembrança, um desejo, uma história." },
  { href: "/minhas-memorias", icon: "♡", title: "Ver minhas contribuições", text: "Acompanhe o que você já enviou." },
];

export function HomeActions() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {ACTIONS.map((a) => (
        <li key={a.href}>
          <Link
            href={a.href}
            className="group flex items-center gap-4 rounded-[1.75rem] border border-line bg-paper py-3 pr-5 pl-3 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-rose-deep/40"
          >
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-rose-soft text-2xl">
              {a.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-bold text-ink">{a.title}</span>
              <span className="block text-sm text-taupe">{a.text}</span>
            </span>
            <span aria-hidden="true" className="ml-auto text-taupe transition group-hover:translate-x-0.5 group-hover:text-rose-deep">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function HomeHero({ name }: { name?: string | null }) {
  return (
    <div className="relative mb-8 text-center">
      <SparkleDoodle className="absolute -top-4 left-2 size-8 text-rose-deep/60" />
      <HeartDoodle className="absolute top-0 right-2 size-10 rotate-12 text-rose-deep/60" />
      {name && <p className="mb-1 text-lg font-semibold text-taupe">Olá, {name} ♡</p>}
      <h1 className="text-5xl sm:text-6xl">Você faz parte da história da Maya</h1>
      <HeartDivider className="mx-auto mt-4 max-w-xs" />
      <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ink/80">
        Um cantinho para guardar <strong className="text-rose-deep">momentos, palavras e lembranças</strong> que ela vai
        descobrir ao longo da vida.
      </p>
    </div>
  );
}
