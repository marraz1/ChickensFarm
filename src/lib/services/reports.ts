import { prisma } from "@/lib/prisma";
import { getExpensesByCategoryReport } from "@/lib/services/expenses";
import type { ExpenseCategory } from "@/generated/prisma/client";

export type ProfitLossRange = { from: Date; to: Date };

export type ProfitLossMonth = {
  year: number;
  /** 0-based, matching Date#getUTCMonth and formatMonthLT. */
  month: number;
  income: number;
  expenses: number;
  profit: number;
};

export type ProfitLossReport = {
  /** Income currently means egg sales only — there is no other income model. */
  income: number;
  expenses: number;
  profit: number;
  eggsSold: number;
  expensesByCategory: Record<ExpenseCategory, number>;
  monthly: ProfitLossMonth[];
};

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
}

// Per-month and per-category buckets accumulate many Decimals, and repeated
// float addition drifts (0.1 + 0.2). Sum in integer cents and divide once, so
// the month rows and category rows add up to the totals exactly.
function toCents(value: unknown): number {
  return Math.round(Number(value ?? 0) * 100);
}

export async function getProfitLossReport(
  farmId: string,
  range: ProfitLossRange,
): Promise<ProfitLossReport> {
  const dateFilter = { gte: range.from, lte: range.to };

  const [salesAgg, expensesByCategory, salesByDate, expensesByDate] = await Promise.all([
    prisma.eggSale.aggregate({
      where: { farmId, saleDate: dateFilter },
      _sum: { totalAmount: true, quantity: true },
    }),
    getExpensesByCategoryReport(farmId, range),
    // Grouped by exact date rather than month: Prisma cannot group on a
    // date_trunc expression, and both tables are indexed on [farmId, <date>],
    // so this stays one indexed scan per table instead of 12 aggregates.
    prisma.eggSale.groupBy({
      by: ["saleDate"],
      where: { farmId, saleDate: dateFilter },
      _sum: { totalAmount: true },
    }),
    prisma.expense.groupBy({
      by: ["expenseDate"],
      where: { farmId, expenseDate: dateFilter },
      _sum: { amount: true },
    }),
  ]);

  type Bucket = { year: number; month: number; incomeCents: number; expensesCents: number };
  const buckets = new Map<string, Bucket>();
  const bucketFor = (date: Date) => {
    const key = monthKey(date);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth(),
        incomeCents: 0,
        expensesCents: 0,
      };
      buckets.set(key, bucket);
    }
    return bucket;
  };

  for (const row of salesByDate) {
    bucketFor(row.saleDate).incomeCents += toCents(row._sum.totalAmount);
  }
  for (const row of expensesByDate) {
    bucketFor(row.expenseDate).expensesCents += toCents(row._sum.amount);
  }

  const monthly = [...buckets.values()]
    .map(({ year, month, incomeCents, expensesCents }) => ({
      year,
      month,
      income: incomeCents / 100,
      expenses: expensesCents / 100,
      profit: (incomeCents - expensesCents) / 100,
    }))
    .sort((a, b) => a.year - b.year || a.month - b.month);

  const incomeCents = toCents(salesAgg._sum.totalAmount);
  const expensesCents = Object.values(expensesByCategory).reduce(
    (sum, value) => sum + toCents(value),
    0,
  );

  return {
    income: incomeCents / 100,
    expenses: expensesCents / 100,
    profit: (incomeCents - expensesCents) / 100,
    eggsSold: salesAgg._sum.quantity ?? 0,
    expensesByCategory,
    monthly,
  };
}

/**
 * Earliest year that has any financial record, used to bound the year filter.
 * Falls back to the current year when the farm has no records yet.
 */
export async function getEarliestFinanceYear(farmId: string): Promise<number> {
  const [firstSale, firstExpense] = await Promise.all([
    prisma.eggSale.findFirst({
      where: { farmId },
      orderBy: { saleDate: "asc" },
      select: { saleDate: true },
    }),
    prisma.expense.findFirst({
      where: { farmId },
      orderBy: { expenseDate: "asc" },
      select: { expenseDate: true },
    }),
  ]);

  const years = [firstSale?.saleDate, firstExpense?.expenseDate]
    .filter((date): date is Date => date != null)
    .map((date) => date.getUTCFullYear());

  return years.length > 0 ? Math.min(...years) : new Date().getUTCFullYear();
}
