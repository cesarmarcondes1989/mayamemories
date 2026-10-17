import { cn } from "@/components/ui/cn";

// Gráficos simples, renderizados no servidor. Uma série por gráfico (nunca dois
// eixos), barras finas com ponta arredondada, rótulos em cor de texto e dica ao
// passar o mouse ou focar com o teclado.

const nf = new Intl.NumberFormat("pt-BR");
export const fmt = (n: number) => nf.format(n);

export function ColumnChart({
  data,
  label,
  height = 160,
  every = 1,
}: {
  data: Array<{ label: string; value: number; tip: string }>;
  label: string;
  height?: number;
  /** Mostrar rótulo do eixo a cada N colunas */
  every?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure aria-label={label} className="pt-5">
      <div className="relative flex items-end gap-[2px] border-b border-line" style={{ height }}>
        {/* linhas de grade discretas */}
        {[0.5, 1].map((g) => (
          <span key={g} aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${g * 100}%` }} />
        ))}
        <span aria-hidden="true" className="absolute -top-5 left-0 text-xs text-taupe">{fmt(max)}</span>
        {data.map((d, i) => (
          <div key={i} tabIndex={0} className="group relative flex h-full flex-1 items-end outline-none" aria-label={d.tip}>
            <div
              className="w-full rounded-t-[4px] bg-rose-deep/85 transition-colors group-hover:bg-rose-deep group-focus:bg-rose-deep"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0 }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-xs whitespace-nowrap text-paper group-hover:block group-focus:block">
              {d.tip}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-taupe" aria-hidden="true">
        {data.map((d, i) => (
          <span key={i} className="flex-1 overflow-visible text-center whitespace-nowrap">{i % every === 0 ? d.label : ""}</span>
        ))}
      </div>
    </figure>
  );
}

export function BarList({
  rows,
  empty = "Sem dados ainda",
  extra,
}: {
  rows: Array<{ label: string; n: number; extra?: string }>;
  empty?: string;
  extra?: string;
}) {
  if (!rows.length) return <p className="text-sm text-taupe">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.n));
  const total = rows.reduce((a, r) => a + r.n, 0);
  return (
    <table className="w-full text-sm">
      {extra && (
        <thead>
          <tr className="text-xs text-taupe">
            <th className="sr-only">Item</th>
            <th className="text-right font-normal">sessões</th>
            <th className="w-16 text-right font-normal">{extra}</th>
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="group">
            <td className="relative py-1 pr-2">
              <span aria-hidden="true" className="absolute inset-y-0.5 left-0 rounded-[4px] bg-rose-soft group-hover:bg-rose/60" style={{ width: `${(r.n / max) * 100}%` }} />
              <span className="relative block truncate px-2">{r.label}</span>
            </td>
            <td className="w-20 py-1 text-right font-semibold tabular-nums" title={`${Math.round((r.n / total) * 100)}% do total`}>
              {fmt(r.n)}
            </td>
            {extra && <td className="w-16 py-1 text-right tabular-nums text-taupe">{r.extra}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Funnel({ steps }: { steps: Array<{ step: string; sessions: number }> }) {
  const top = Math.max(1, steps[0]?.sessions ?? 0);
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].sessions : null;
        const pct = Math.round((s.sessions / top) * 100);
        return (
          <li key={s.step} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate">{s.step}</span>
              <span className="shrink-0 tabular-nums">
                <strong>{fmt(s.sessions)}</strong>
                {i > 0 && (
                  <span className="text-taupe"> · {prev ? `${Math.round((s.sessions / prev) * 100)}% da etapa` : "—"}</span>
                )}
              </span>
            </div>
            <span className="mt-1 block h-3 rounded-[4px] bg-rose-soft">
              <span className="block h-full rounded-[4px] bg-rose-deep/85" style={{ width: `${Math.max(pct, s.sessions ? 1 : 0)}%` }} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Kpi({ label, value, delta, hint, className }: { label: string; value: string; delta?: number | null; hint?: string; className?: string }) {
  return (
    <div className={cn("rounded-3xl border border-line bg-paper p-4 shadow-[var(--shadow-soft)]", className)}>
      <p className="text-xs font-bold tracking-wider text-taupe uppercase">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {delta != null && Number.isFinite(delta) && (
        <p className="text-xs text-taupe">
          <span aria-hidden="true">{delta >= 0 ? "▲" : "▼"}</span> {Math.abs(Math.round(delta))}% vs. período anterior
        </p>
      )}
      {hint && <p className="text-xs text-taupe">{hint}</p>}
    </div>
  );
}
