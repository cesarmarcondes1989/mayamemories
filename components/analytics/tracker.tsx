"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { getConsent, setConsent, track, type TrackEvent } from "./client";

/** Conta as páginas vistas da vitrine e mostra o aviso de cookies. */
export function AnalyticsTracker() {
  const pathname = usePathname();
  const [askConsent, setAskConsent] = useState(false);

  useEffect(() => {
    setAskConsent(getConsent() === null);
  }, []);

  useEffect(() => {
    track("page_view");
  }, [pathname]);

  if (!askConsent) return null;
  const choose = (value: "yes" | "no") => {
    setConsent(value);
    setAskConsent(false);
  };
  return (
    <div role="dialog" aria-label="Cookies" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg rounded-3xl border border-line bg-paper p-4 shadow-[var(--shadow-soft)] sm:bottom-5">
      <p className="text-sm leading-relaxed">
        🍪 Usamos cookies só para entender como as pessoas chegam até aqui e melhorar o site. Sem anúncios, sem vender dados.{" "}
        <Link href="/privacidade" className="underline underline-offset-4">Saiba mais</Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => choose("yes")} className="h-10 flex-1 rounded-full bg-rose-deep px-4 text-sm font-semibold text-white">
          Tudo bem
        </button>
        <button type="button" onClick={() => choose("no")} className="h-10 flex-1 rounded-full border border-line px-4 text-sm text-taupe">
          Só o essencial
        </button>
      </div>
    </div>
  );
}

/** Dispara um evento quando o elemento aparece na tela (uma vez). */
export function TrackView({ event, targetId }: { event: TrackEvent; targetId: string }) {
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          track(event);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [event, targetId]);
  return null;
}

/** Link que registra um clique de interesse (ex.: escolher um plano). */
export function TrackedLink({
  event,
  plan,
  ...props
}: React.ComponentProps<typeof Link> & { event: TrackEvent; plan?: string }) {
  return <Link {...props} onClick={(e) => { track(event, { plan }); props.onClick?.(e); }} />;
}
