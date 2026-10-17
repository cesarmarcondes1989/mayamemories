import Link from "next/link";
import { Logo } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { getBrand } from "@/features/plans/queries";
import { getViewer } from "@/lib/permissions/viewer";
import { isSupabaseConfigured } from "@/lib/env";
import { AnalyticsTracker } from "@/components/analytics/tracker";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [brand, viewer] = await Promise.all([
    getBrand(),
    isSupabaseConfigured() ? getViewer().catch(() => null) : null,
  ]);
  const home = viewer?.personId ? (viewer.isAdmin ? "/admin" : "/inicio") : viewer ? "/baus" : null;
  return (
    <div className="paper-grain flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-5">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Logo className="size-9 shrink-0" />
          <span className="truncate font-display text-3xl">{brand.brand_name}</span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1 text-[15px]">
          <Link href="/#planos" className="hidden rounded-full px-3 py-2 text-taupe hover:text-ink sm:block">
            Planos
          </Link>
          <Link href="/#perguntas" className="hidden rounded-full px-3 py-2 text-taupe hover:text-ink sm:block">
            Dúvidas
          </Link>
          {home ? (
            <Link href={home} className={buttonClasses("secondary", "sm", "px-4")}>
              Meu baú →
            </Link>
          ) : (
            <>
              <Link href="/entrar" className="rounded-full px-3 py-2 text-taupe hover:text-ink">
                Entrar
              </Link>
              <Link href="/comecar" className={buttonClasses("primary", "sm", "px-4")}>
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-16">{children}</main>
      <AnalyticsTracker />
      <footer className="mx-auto w-full max-w-5xl px-5 pb-8 text-sm text-taupe">
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-5">
          <span>{brand.brand_name} · um espaço privado de família.</span>
          <Link href="/#quero" className="underline-offset-4 hover:underline">
            Quero o meu
          </Link>
          <Link href="/privacidade" className="underline-offset-4 hover:underline">
            Privacidade
          </Link>
          {brand.contact_email && (
            <a href={`mailto:${brand.contact_email}`} className="underline-offset-4 hover:underline">
              {brand.contact_email}
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
