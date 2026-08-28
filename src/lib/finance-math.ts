/**
 * The money arithmetic behind the finance reports, kept free of imports (Prisma
 * included) so it can be unit-tested directly — the same reason
 * notification-schedule.ts is standalone.
 *
 * Everything is summed in integer cents: per-month and per-category buckets
 * accumulate many Decimals, and repeated float addition drifts (0.1 + 0.2), so
 * the month rows would stop adding up to the totals shown above them.
 */

/** A Decimal, string, number or null from the database → whole cents. */
export function toCents(value: unknown): number {
  return Math.round(Number(value ?? 0) * 100);
}

/** One dated amount, already reduced to the side of the ledger it belongs on. */
export type LedgerEntry = {
  date: Date;
  incomeCents?: number;
  expensesCents?: number;
};

export type MonthlyTotal = {
  year: number;
  /** 0-based, matching Date#getUTCMonth and formatMonthLT. */
  month: number;
  income: number;
  expenses: number;
  profit: number;
};

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
}

/**
 * Folds dated entries — egg sales, expenses, bird sales and bird purchases
 * alike — into one row per calendar month, oldest first. Months with no records
 * are absent rather than zero-filled, which is what the P&L list renders.
 *
 * Dates are read in UTC because the source columns are `@db.Date`, which Prisma
 * returns at exactly 00:00:00.000Z; reading them locally would push records
 * dated the 1st into the previous month west of UTC.
 */
export function buildMonthlyTotals(entries: LedgerEntry[]): MonthlyTotal[] {
  type Bucket = { year: number; month: number; incomeCents: number; expensesCents: number };
  const buckets = new Map<string, Bucket>();

  for (const entry of entries) {
    const key = monthKey(entry.date);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        year: entry.date.getUTCFullYear(),
        month: entry.date.getUTCMonth(),
        incomeCents: 0,
        expensesCents: 0,
      };
      buckets.set(key, bucket);
    }
    bucket.incomeCents += entry.incomeCents ?? 0;
    bucket.expensesCents += entry.expensesCents ?? 0;
  }

  return [...buckets.values()]
    .map(({ year, month, incomeCents, expensesCents }) => ({
      year,
      month,
      income: incomeCents / 100,
      expenses: expensesCents / 100,
      profit: (incomeCents - expensesCents) / 100,
    }))
    .sort((a, b) => a.year - b.year || a.month - b.month);
}
