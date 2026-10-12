import Link from "next/link";
import { Logo } from "@/components/ui/misc";
import { NavLinks } from "./nav-links";

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
    <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/inicio" className="flex shrink-0 items-center gap-2" aria-label="Maya Memories — início">
          <Logo className="size-8" />
          <span className="hidden font-display text-2xl text-rose-deep sm:inline">Maya Memories</span>
        </Link>
        <NavLinks links={links} />
      </div>
    </header>
  );
}
