import Link from "next/link";
import { boldParts, pickNudge, subjectCounter, type MemoryStats } from "@/lib/nudges";

function Rich({ text }: { text: string }) {
  return (
    <>
      {boldParts(text).map((p, i) =>
        p.bold ? (
          <strong key={i} className="text-rose-deep">
            {p.text}
          </strong>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** Números da própria pessoa + uma provocação carinhosa (muda a cada visita). */
export function NudgeCard({ stats }: { stats: MemoryStats | null }) {
  if (!stats || !stats.enabled) return null;
  const nudge = pickNudge(stats);
  const counter = subjectCounter(stats);
  const chips = [
    { n: stats.my_total, label: stats.my_total === 1 ? "lembrança sua" : "lembranças suas" },
    { n: stats.my_approved, label: "na linha do tempo" },
    { n: stats.family_total, label: "da família toda" },
  ];
  return (
    <section aria-label="Suas lembranças" className="mb-8 space-y-3">
      {counter && (
        <p className="text-center text-[15px] text-ink/80">
          <Rich text={counter} /> e já tem <strong className="text-rose-deep">{stats.family_total}</strong> lembranças guardadas pela família ♡
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {chips.map((c) => (
          <div key={c.label} className="rounded-3xl bg-paper px-2 py-3 text-center shadow-[var(--shadow-soft)]">
            <p className="font-display text-4xl leading-none">{c.n}</p>
            <p className="mt-1 text-[11px] leading-tight text-taupe">{c.label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-[1.75rem] border border-rose/60 bg-rose-soft/70 p-4">
        <p className="text-[15px] leading-relaxed text-ink">
          <Rich text={nudge.text} />
        </p>
        <Link
          href={nudge.cta.href}
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-rose-deep px-5 text-sm font-semibold text-white"
        >
          {nudge.cta.label} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
