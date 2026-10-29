// The period a V2 finance screen covers (#198 area Finansai, #201 farm
// overview): "Šis mėn.", "<year> m." or a chosen "Laikotarpis". Pure, so it is
// unit-tested without a request; the page hands it the awaited searchParams.
//
// URL shape: no parameter → this year (the designs' default); `?period=month`
// → this month; `?period=range&from=YYYY-MM-DD&to=YYYY-MM-DD` → a range. "This"
// month and year are the farm's (Europe/Vilnius), not the server's UTC — at
// 00:30 on January 1st in Vilnius the screen already shows the new year.
import { DEFAULT_TIME_ZONE, getLocalNow } from "@/lib/notification-schedule";
import { formatDateLT, formatMonthYearLT } from "@/lib/format";

// Years a typed or bookmarked date may name. Bounds the month list a
// "Laikotarpis" renders, and keeps Date.UTC from reading 0050 as 1950.
const MIN_YEAR = 2000;
const MAX_YEAR = 2099;

export type SearchParam = string | string[] | undefined;

export type FinancePeriodKind = "month" | "year" | "range";

export type FinancePeriod = {
  kind: FinancePeriodKind;
  /** Inclusive bounds at UTC midnight, matching the `@db.Date` columns. */
  from: Date;
  to: Date;
  /** "Spalis 2026", "2026 m." or "2026-03-01 – 2026-10-15" (formatDateLT). */
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

/**
 * Strict "YYYY-MM-DD" → UTC midnight. Rejects near-misses, rolled-over dates
 * and years outside 2000–2099.
 */
export function parseUtcDateInput(value: SearchParam): Date | null {
  const raw = firstParam(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  // Guards against 2026-02-31 silently becoming March 3rd.
  return parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? parsed : null;
}

export function resolveFinancePeriod(
  params: { period?: SearchParam; from?: SearchParam; to?: SearchParam },
  now: Date = new Date(),
): FinancePeriod {
  const today = parseUtcDateInput(getLocalNow(now, DEFAULT_TIME_ZONE).date)!;
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
    // A missing end is today; a missing start is January 1st of the end's
    // year, so "up to 2020-05-01" stays in 2020. A reversed range is swapped
    // rather than shown empty. Nothing runs past this year's end, which with
    // MIN_YEAR caps the months listed.
    const endOfYear = new Date(Date.UTC(year, 11, 31));
    let to = parseUtcDateInput(params.to) ?? today;
    let from = parseUtcDateInput(params.from) ?? new Date(Date.UTC(to.getUTCFullYear(), 0, 1));
    if (from > to) [from, to] = [to, from];
    if (to > endOfYear) to = endOfYear;
    if (from > to) from = new Date(Date.UTC(year, 0, 1));
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
