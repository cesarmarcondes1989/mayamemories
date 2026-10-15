"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

/** Menu “☰” para telas pequenas: abre a lista completa de páginas. */
export function MobileMenu({ links, footer }: { links: Array<{ href: string; label: string; badge?: number }>; footer?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  // Trava a rolagem da página enquanto o menu está aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  const pending = links.reduce((a, l) => a + (l.badge ?? 0), 0);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="relative inline-flex h-10 items-center gap-2 rounded-full border border-rose/70 bg-paper px-4 text-sm font-semibold text-rose-deep"
      >
        ☰ Menu
        {pending > 0 && (
          <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-rose-deep text-[10px] text-white">{pending}</span>
        )}
      </button>
      {open &&
        // Portal no <body>: um ancestral com backdrop-filter "prenderia" o position:fixed
        createPortal(
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-cream px-4 pt-20 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed top-3 right-4 inline-flex h-10 items-center rounded-full border border-rose/70 bg-paper px-4 text-sm font-semibold text-rose-deep"
          >
            ✕ Fechar
          </button>
          <ul className="mx-auto grid max-w-md gap-2">
            {links.map((l) => {
              const active = pathname === l.href || (l.href !== "/admin" && pathname.startsWith(l.href + "/"));
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={cn(
                      "flex items-center justify-between rounded-full px-5 py-3.5 text-[15px] font-semibold",
                      active ? "bg-rose-deep text-white" : "bg-paper text-ink shadow-[var(--shadow-soft)]",
                    )}
                  >
                    {l.label}
                    {l.badge ? <span className={cn("rounded-full px-2 text-xs", active ? "bg-white/25" : "bg-rose-soft text-rose-deep")}>{l.badge}</span> : <span aria-hidden="true">›</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
          {footer && <div className="mx-auto mt-6 max-w-md">{footer}</div>}
        </div>,
        document.body,
      )}
    </>
  );
}
