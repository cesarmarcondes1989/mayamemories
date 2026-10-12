import type { MemoryRow } from "@/features/memories/queries";
import { MemoryCard } from "@/components/memories/memory-card";
import { parseDate } from "@/lib/format";

/** Linha do tempo agrupada por ano (data do acontecimento, não do envio). */
export function Timeline({ memories, hrefFor }: { memories: MemoryRow[]; hrefFor: (m: MemoryRow) => string }) {
  const groups = new Map<number, MemoryRow[]>();
  for (const m of memories) {
    const year = parseDate(m.occurred_at ?? m.created_at).getFullYear();
    groups.set(year, [...(groups.get(year) ?? []), m]);
  }
  return (
    <div className="space-y-12">
      {[...groups.entries()].map(([year, items]) => (
        <section key={year} aria-labelledby={`year-${year}`} className="relative">
          <h2 id={`year-${year}`} className="sticky top-16 z-10 mb-5 inline-block rounded-full bg-cream/90 py-1 pr-4 font-display text-4xl text-rose-deep backdrop-blur">
            {year}
          </h2>
          <ol className="relative space-y-6 border-l border-line pl-6 sm:pl-8">
            {items.map((m) => (
              <li key={m.id} className="relative">
                <span
                  aria-hidden="true"
                  className={`absolute top-6 -left-[29px] size-3 rounded-full border-2 border-cream sm:-left-[37px] ${m.is_highlight ? "bg-rose-deep" : "bg-sage"}`}
                />
                <MemoryCard memory={m} href={hrefFor(m)} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
