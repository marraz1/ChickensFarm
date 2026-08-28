import { describe, it, expect } from "vitest";
// Relative import, like notification-schedule.test.ts: the module under test has
// no internal imports, so the suite needs no vitest config.
import { toCents, buildMonthlyTotals, type LedgerEntry } from "./finance-math";

/** `@db.Date` values come back from Prisma at exactly UTC midnight. */
const day = (year: number, month: number, date: number) => new Date(Date.UTC(year, month, date));

describe("toCents", () => {
  it("converts amounts to whole cents", () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents("8.50")).toBe(850);
    expect(toCents(0)).toBe(0);
  });

  it("treats a missing sum as zero", () => {
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
  });

  it("rounds rather than truncating the half-cent a Decimal can carry", () => {
    expect(toCents(0.005)).toBe(1);
    expect(toCents(19.999)).toBe(2000);
  });
});

describe("buildMonthlyTotals", () => {
  it("returns nothing when there are no records", () => {
    expect(buildMonthlyTotals([])).toEqual([]);
  });

  it("sums income and expenses into one row per month, oldest first", () => {
    const monthly = buildMonthlyTotals([
      { date: day(2026, 1, 10), incomeCents: 5_000 },
      { date: day(2026, 0, 5), incomeCents: 1_000 },
      { date: day(2026, 0, 20), expensesCents: 400 },
    ]);

    expect(monthly).toEqual([
      { year: 2026, month: 0, income: 10, expenses: 4, profit: 6 },
      { year: 2026, month: 1, income: 50, expenses: 0, profit: 50 },
    ]);
  });

  it("orders across a year boundary by year before month", () => {
    const monthly = buildMonthlyTotals([
      { date: day(2026, 0, 1), incomeCents: 100 },
      { date: day(2025, 11, 1), incomeCents: 100 },
    ]);

    expect(monthly.map((m) => [m.year, m.month])).toEqual([
      [2025, 11],
      [2026, 0],
    ]);
  });

  it("nets bird purchases against bird sales in the same month", () => {
    // A farm that bought 10 birds at 8,00 € and sold 4 at 15,00 € that month.
    const monthly = buildMonthlyTotals([
      { date: day(2026, 7, 3), expensesCents: toCents(80) },
      { date: day(2026, 7, 21), incomeCents: toCents(60) },
    ]);

    expect(monthly).toEqual([{ year: 2026, month: 7, income: 60, expenses: 80, profit: -20 }]);
  });

  it("keeps cent sums exact where float addition would drift", () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point; summing cents avoids it.
    const entries: LedgerEntry[] = [
      { date: day(2026, 2, 1), incomeCents: toCents(0.1) },
      { date: day(2026, 2, 2), incomeCents: toCents(0.2) },
    ];

    expect(buildMonthlyTotals(entries)[0].income).toBe(0.3);
  });

  it("buckets a record dated the 1st into its own month", () => {
    // Read in UTC on purpose: a local-midnight reading west of UTC would push
    // this into February.
    const monthly = buildMonthlyTotals([{ date: day(2026, 2, 1), incomeCents: 100 }]);

    expect(monthly).toEqual([{ year: 2026, month: 2, income: 1, expenses: 0, profit: 1 }]);
  });
});
