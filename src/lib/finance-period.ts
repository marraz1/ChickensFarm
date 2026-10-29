// The period a V2 finance screen covers (#198 area Finansai, #201 farm
// overview): "Šis mėn.", "<year> m." or a chosen "Laikotarpis". Pure, so it is
// unit-tested without a request; the page hands it the awaited searchParams.
//
// URL shape: no parameter → this year (the designs' default); `?period=month`
// → this month; `?period=range&from=YYYY-MM-DD&to=YYYY-MM-DD` → a range. "This"
// month and year are the farm's (Europe/Vilnius), not the server's UTC — at
// 00:30 on January 1st in Vilnius the screen already shows the new year.
import { getLocalNow } from "@/lib/notification-schedule";
import { formatDateLT, formatMonthYearLT } from "@/lib/format";

export const FARM_TIME_ZONE = "Europe/Vilnius";

export type SearchParam = string | string[] | undefined;

export type FinancePeriodKind = "month" | "year" | "range";

export type FinancePeriod = {
  kind: FinancePeriodKind;
  /** Inclusive bounds at UTC midnight, matching the `@db.Date` columns. */
  from: Date;
  to: Date;
  /** "Spalis 2026", "2026 m." or "01.03.2026 – 15.10.2026". */
  label: string;
  /** The farm's today at UTC midnight; months after it are not listed. */
  today: Date;
  /** The farm's current year, for the "<year> m." chip. */
  year: number;
};

/** Repeated query keys arrive as arrays in Next 16 — keep the first value. */
export function firstParam(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Strict "YYYY-MM-DD" → UTC midnight. Rejects near-misses and rolled-over dates. */
export function parseUtcDateInput(value: SearchParam): Date | null {
  const raw = firstParam(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  // Guards against 2026-02-31 silently becoming March 3rd.
  return parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? parsed : null;
}

/** "2026-10-29" for a UTC-midnight date — the value a date input expects. */
export function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveFinancePeriod(
  params: { period?: SearchParam; from?: SearchParam; to?: SearchParam },
  now: Date = new Date(),
): FinancePeriod {
  const today = parseUtcDateInput(getLocalNow(now, FARM_TIME_ZONE).date)!;
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const base = { today, year };

  const period = firstParam(params.period);
  if (period === "month") {
    return {
      ...base,
      kind: "month",
      from: new Date(Date.UTC(year, month, 1)),
      // Day 0 of the next month is the last day of this one.
      to: new Date(Date.UTC(year, month + 1, 0)),
      label: formatMonthYearLT(year, month),
    };
  }

  if (period === "range") {
    // A missing end leaves the range open from the year start or up to today;
    // a reversed one is swapped rather than shown empty.
    let from = parseUtcDateInput(params.from) ?? new Date(Date.UTC(year, 0, 1));
    let to = parseUtcDateInput(params.to) ?? today;
    if (from > to) [from, to] = [to, from];
    return {
      ...base,
      kind: "range",
      from,
      to,
      label: `${formatDateLT(from)} – ${formatDateLT(to)}`,
    };
  }

  return {
    ...base,
    kind: "year",
    from: new Date(Date.UTC(year, 0, 1)),
    to: new Date(Date.UTC(year, 11, 31)),
    label: `${year} m.`,
  };
}
