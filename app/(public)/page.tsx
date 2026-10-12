import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { HeartDivider, HeartDoodle, SparkleDoodle } from "@/components/ui/doodles";
import { getViewer } from "@/lib/permissions/viewer";
import { isSupabaseConfigured } from "@/lib/env";

export default async function HomePage() {
  if (isSupabaseConfigured()) {
    const viewer = await getViewer();
    if (viewer?.personId) redirect(viewer.isAdmin ? "/admin" : "/inicio");
  }
  return (
    <section className="grid min-h-[70dvh] place-items-center text-center">
      <div className="relative max-w-xl">
        <SparkleDoodle className="absolute -top-6 -left-2 size-9 text-rose-deep/70" />
        <HeartDoodle className="absolute -top-2 -right-2 size-12 rotate-12 text-rose-deep/70" />
        <h1 className="text-6xl sm:text-8xl">
          Um dia, Maya vai descobrir quem estava lá
        </h1>
        <HeartDivider className="mx-auto mt-6 max-w-sm" />
        <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-ink/80">
          Um cantinho da família para guardar <strong className="text-rose-deep">fotos, vozes e cartinhas</strong> que ela vai
          descobrir ao longo da vida.
        </p>
        <div className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-3 text-left">
          <div className="flex items-center gap-3 rounded-3xl bg-paper/80 p-3 shadow-[var(--shadow-soft)]">
            <span aria-hidden="true" className="grid size-11 place-items-center rounded-2xl bg-rose-soft text-xl">🧸</span>
            <span className="text-sm leading-tight"><strong className="block text-rose-deep">Ursinho NFC</strong>encostou, entrou</span>
          </div>
          <div className="flex items-center gap-3 rounded-3xl bg-paper/80 p-3 shadow-[var(--shadow-soft)]">
            <span aria-hidden="true" className="grid size-11 place-items-center rounded-2xl bg-rose-soft text-xl">🔒</span>
            <span className="text-sm leading-tight"><strong className="block text-rose-deep">Privado</strong>só a família</span>
          </div>
        </div>
        <ButtonLink href="/entrar" size="lg" className="mt-8 px-10">
          Entrar <span aria-hidden="true">→</span>
        </ButtonLink>
        <p className="mt-5 text-sm text-taupe">Acesso por convite dos pais da Maya · 2026 — 2042</p>
      </div>
    </section>
  );
}
