const TZ = "America/Sao_Paulo";

export function formatDate(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!value) return "—";
  const d = typeof value === "string" ? parseDate(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ, ...opts }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}

/** Datas "YYYY-MM-DD" representam o dia civil, sem fuso. */
export function parseDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00-03:00`);
  return new Date(value);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function yearOf(value: string | null | undefined): number | null {
  if (!value) return null;
  return parseDate(value).getFullYear();
}
