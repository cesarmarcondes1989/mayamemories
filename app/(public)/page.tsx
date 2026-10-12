import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { getViewer } from "@/lib/permissions/viewer";
import { isSupabaseConfigured } from "@/lib/env";

export default async function HomePage() {
  if (isSupabaseConfigured()) {
    const viewer = await getViewer();
    if (viewer?.personId) redirect(viewer.isAdmin ? "/admin" : "/inicio");
  }
  return (
    <section className="grid min-h-[70dvh] place-items-center text-center">
      <div className="max-w-2xl">
        <p className="mb-4 text-xs font-medium tracking-[0.24em] text-rose-deep uppercase">2026 — 2042</p>
        <h1 className="text-5xl leading-[1.05] text-ink sm:text-7xl">
          Um dia, Maya vai descobrir <em className="text-rose-deep">quem estava lá.</em>
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-taupe">
          Um legado familiar construído por quem a ama: fotos, vozes, cartas e lembranças guardadas com cuidado
          para serem descobertas ao longo da vida.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href="/entrar" size="lg">
            Entrar com meu e-mail
          </ButtonLink>
        </div>
        <p className="mt-6 text-sm text-taupe">Acesso somente por convite dos pais da Maya.</p>
      </div>
    </section>
  );
}
