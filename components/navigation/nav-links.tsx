"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

export function NavLinks({ links, vertical = false }: { links: Array<{ href: string; label: string; badge?: number }>; vertical?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação principal" className={cn("min-w-0 flex-1", vertical ? "" : "overflow-x-auto")}>
      <ul className={cn("flex gap-1", vertical ? "flex-col" : "items-center justify-end whitespace-nowrap")}>
        {links.map((l) => {
          const active = pathname === l.href || (l.href !== "/admin" && l.href !== "/inicio" && pathname.startsWith(l.href + "/")) || (l.href === "/admin" && pathname === "/admin");
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-full px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-ink text-paper" : "text-taupe hover:bg-paper hover:text-ink",
                )}
              >
                {l.label}
                {l.badge ? (
                  <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-paper/20" : "bg-rose-soft text-rose-deep")}>{l.badge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
