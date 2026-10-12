import { cn } from "./cn";
import { MODERATION_LABELS, VISIBILITY_LABELS } from "@/lib/constants";

type Tone = "neutral" | "pending" | "ok" | "warn" | "error" | "rose" | "sage";
const tones: Record<Tone, string> = {
  neutral: "bg-cream text-taupe border-line",
  pending: "bg-amber-soft text-amber border-amber/20",
  ok: "bg-sage-soft text-[#56634f] border-sage/40",
  warn: "bg-amber-soft text-amber border-amber/30",
  error: "bg-danger-soft text-danger border-danger/20",
  rose: "bg-rose-soft text-rose-deep border-rose/60",
  sage: "bg-sage-soft text-[#56634f] border-sage/40",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Indicador de aprovação */
export function StatusBadge({ status }: { status: string }) {
  const s = MODERATION_LABELS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** Indicador de privacidade */
export function PrivacyBadge({ visibility }: { visibility: string }) {
  const icon = visibility === "capsule" ? "⧗" : visibility === "private" ? "🔒" : visibility === "family" ? "♡" : "◎";
  return (
    <Badge tone={visibility === "capsule" ? "sage" : "neutral"}>
      <span aria-hidden="true">{icon}</span> {VISIBILITY_LABELS[visibility] ?? visibility}
    </Badge>
  );
}
