export function formatDateLT(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("lt-LT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

// Parses a user-entered decimal that may use the Lithuanian comma separator
// ("1,50" → 1.5). Returns NaN for empty/invalid input so callers/validators can
// decide how to treat it.
export function parseDecimalInput(value: unknown): number {
  if (typeof value === "number") return value;
  const s = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  return s === "" ? NaN : Number(s);
}

export function formatEUR(amount: number | string | { toString(): string }): string {
  const n = typeof amount === "number" ? amount : Number(amount.toString());
  return new Intl.NumberFormat("lt-LT", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export function formatRelativeLT(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);

  const time = new Intl.DateTimeFormat("lt-LT", { hour: "2-digit", minute: "2-digit" }).format(d);

  if (dayDiff === 0) return `Šiandien, ${time}`;
  if (dayDiff === 1) return `Vakar, ${time}`;
  return `${formatDateLT(d)}, ${time}`;
}

export function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio == null) return "—";
  return `${Math.round(ratio * 100)}%`;
}
