import Link from "next/link";
import { Logo } from "@/components/ui/misc";
import { NavLinks } from "./nav-links";
import { BottomTabs } from "./bottom-tabs";

const LINKS = [
  { href: "/inicio", label: "Início" },
  { href: "/linha-do-tempo", label: "Linha do tempo" },
  { href: "/capsulas", label: "Cápsulas" },
  { href: "/minhas-memorias", label: "Minhas memórias" },
  { href: "/perfil", label: "Perfil" },
];

export function ContributorNav({ isAdmin }: { isAdmin: boolean }) {
  const links = isAdmin ? [...LINKS, { href: "/admin", label: "Administração" }] : LINKS;
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/inicio" className="flex shrink-0 items-center gap-2" aria-label="Maya Memories — início">
            <Logo className="size-8" />
            <span className="font-display text-2xl text-rose-deep">Maya Memories</span>
          </Link>
          {/* Computador: menu completo no topo */}
          <div className="hidden min-w-0 flex-1 md:block">
            <NavLinks links={links} />
          </div>
          {/* Celular: atalhos que não cabem na barra de baixo */}
          <div className="flex items-center gap-2 md:hidden">
            {isAdmin && (
              <Link href="/admin" className="inline-flex h-9 items-center rounded-full bg-rose-deep px-3 text-sm font-semibold text-white">
                ⚙︎ Admin
              </Link>
            )}
            <Link href="/perfil" aria-label="Perfil" className="grid size-9 place-items-center rounded-full border border-rose/70 bg-paper text-lg">
              👤
            </Link>
          </div>
        </div>
      </header>
      <BottomTabs />
    </>
  );
}
