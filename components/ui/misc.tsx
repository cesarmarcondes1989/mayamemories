import { cn } from "./cn";
import { formatDate } from "@/lib/format";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-medium tracking-[0.18em] text-rose-deep uppercase">{eyebrow}</p>}
        <h1 className="text-4xl leading-tight text-ink sm:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-taupe">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** Estado vazio com mensagem acolhedora */
export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-paper/60 px-6 py-12 text-center">
      <div aria-hidden="true" className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-rose-soft text-xl text-rose-deep">
        ♡
      </div>
      <h3 className="text-2xl text-ink">{title}</h3>
      {children && <p className="mx-auto mt-2 max-w-md text-[15px] text-taupe">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "error" | "warn";
  title?: string;
  children?: React.ReactNode;
}) {
  const styles = {
    info: "bg-paper border-line text-ink",
    success: "bg-sage-soft border-sage/40 text-[#46523f]",
    error: "bg-danger-soft border-danger/20 text-danger",
    warn: "bg-amber-soft border-amber/20 text-[#7a5b26]",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-2xl border px-4 py-3 text-[15px]", styles)}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
    </div>
  );
}

/** Etiqueta de data */
export function DateTag({ date, label }: { date: string | null | undefined; label?: string }) {
  if (!date) return null;
  return (
    <time dateTime={date} className="inline-flex items-center gap-1.5 text-sm text-taupe">
      {label && <span className="text-taupe/70">{label}</span>}
      {formatDate(date)}
    </time>
  );
}

/** Avatar de pessoa (iniciais; sem foto por padrão) */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const hue = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 3;
  const bg = ["bg-rose-soft text-rose-deep", "bg-sage-soft text-[#56634f]", "bg-amber-soft text-amber"][hue];
  const sz = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg" }[size];
  return (
    <span aria-hidden="true" className={cn("inline-grid shrink-0 place-items-center rounded-full font-medium", bg, sz)}>
      {initials || "♡"}
    </span>
  );
}

/** Contador de memórias / estatística */
export function Stat({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: string; href?: string }) {
  const inner = (
    <>
      <p className="text-sm text-taupe">{label}</p>
      <p className="mt-1 font-display text-4xl text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-taupe">{hint}</p>}
    </>
  );
  const cls = "block rounded-[var(--radius-card)] border border-line bg-paper p-5 shadow-[var(--shadow-soft)]";
  return href ? (
    <a href={href} className={cn(cls, "transition-colors hover:border-rose-deep/40")}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div
        className="h-2 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-rose-deep transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="20" cy="18" r="7" fill="#776C67" />
      <circle cx="44" cy="18" r="7" fill="#776C67" />
      <circle cx="32" cy="32" r="17" fill="#776C67" />
      <path
        d="M32 47c-6-4.4-10-8-10-12a5 5 0 0 1 10-1.2A5 5 0 0 1 42 35c0 4-4 7.6-10 12z"
        fill="#E8C7CC"
        stroke="#B97988"
        strokeWidth="1.5"
      />
    </svg>
  );
}
