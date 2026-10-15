"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

const TABS = [
  { href: "/inicio", label: "Início", icon: "🏡" },
  { href: "/linha-do-tempo", label: "Linha", icon: "🌸" },
  { href: "/enviar/foto", label: "Enviar", icon: "＋", primary: true },
  { href: "/capsulas", label: "Cápsulas", icon: "🎁" },
  { href: "/minhas-memorias", label: "Minhas", icon: "♡" },
];

/** Barra inferior fixa no celular (estilo app). Some no computador. */
export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/") || (t.primary && pathname.startsWith("/enviar"));
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold", active ? "text-rose-deep" : "text-taupe")}
              >
                {t.primary ? (
                  <span aria-hidden="true" className="-mt-5 grid size-12 place-items-center rounded-full bg-rose-deep text-2xl text-white shadow-[var(--shadow-soft)]">
                    {t.icon}
                  </span>
                ) : (
                  <span aria-hidden="true" className={cn("grid h-7 w-12 place-items-center rounded-full text-lg", active && "bg-rose-soft")}>
                    {t.icon}
                  </span>
                )}
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
