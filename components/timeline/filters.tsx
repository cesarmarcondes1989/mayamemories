import { MEMORY_TYPE_LABELS } from "@/lib/constants";
import type { TimelineFilters } from "@/features/memories/queries";

export function TimelineFiltersForm({
  filters,
  basePath,
  people = [],
  capsules = [],
  events = [],
}: {
  filters: TimelineFilters;
  basePath: string;
  people?: Array<{ id: string; display_name: string }>;
  capsules?: Array<{ id: string; title: string }>;
  events?: Array<{ id: string; name: string }>;
}) {
  const years = Array.from({ length: 2042 - 2026 + 1 }, (_, i) => 2026 + i);
  const cls = "h-10 rounded-full border border-line bg-paper px-3 text-sm";
  return (
    <form method="get" action={basePath} className="mb-8 flex flex-wrap items-center gap-2" aria-label="Filtros">
      <select name="year" defaultValue={filters.year ?? ""} className={cls} aria-label="Ano">
        <option value="">Todos os anos</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select name="type" defaultValue={filters.type ?? ""} className={cls} aria-label="Tipo">
        <option value="">Todos os tipos</option>
        {Object.entries(MEMORY_TYPE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      {events.length > 0 && (
        <select name="evento" defaultValue={filters.evento ?? ""} className={cls} aria-label="Evento">
          <option value="">Todos os momentos</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              🎉 {e.name}
            </option>
          ))}
        </select>
      )}
      {people.length > 0 && (
        <select name="person" defaultValue={filters.person ?? ""} className={cls} aria-label="Pessoa">
          <option value="">Todas as pessoas</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
      )}
      {capsules.length > 0 && (
        <select name="capsule" defaultValue={filters.capsule ?? ""} className={cls} aria-label="Cápsula">
          <option value="">Todas as cápsulas</option>
          {capsules.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      )}
      <label className="flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-3 text-sm">
        <input type="checkbox" name="highlight" value="1" defaultChecked={filters.highlight === "1"} className="accent-[var(--rose-deep)]" />
        Destaques
      </label>
      <button type="submit" className="h-10 rounded-full bg-rose-deep px-4 text-sm text-white">
        Filtrar
      </button>
    </form>
  );
}
