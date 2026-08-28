import { prisma } from "@/lib/prisma";
import { getExpensesByCategoryReport } from "@/lib/services/expenses";
import { getBirdTransactionTotals } from "@/lib/services/bird-transactions";
import { buildMonthlyTotals, toCents, type MonthlyTotal } from "@/lib/finance-math";
import type { ExpenseCategory } from "@/generated/prisma/client";

export type ProfitLossRange = { from: Date; to: Date };

export type ProfitLossMonth = MonthlyTotal;

export type ProfitLossReport = {
  /** Egg sales plus bird sales. */
  income: number;
  /** Recorded expenses plus what was paid for bought birds. */
  expenses: number;
  profit: number;
  eggsSold: number;
  /** The egg-sales share of `income`. */
  eggSalesIncome: number;
  /** The bird-sales share of `income`. */
  birdSalesIncome: number;
  birdsSold: number;
  /**
   * The bird-purchase share of `expenses`. Kept out of `expensesByCategory`,
   * which only covers Expense rows, so the P&L page can show it as its own row
   * and the breakdown still adds up to the expense total.
   */
  birdPurchaseCost: number;
  birdsBought: number;
  expensesByCategory: Record<ExpenseCategory, number>;
  monthly: ProfitLossMonth[];
};

export async function getProfitLossReport(
  farmId: string,
  range: ProfitLossRange,
): Promise<ProfitLossReport> {
  const dateFilter = { gte: range.from, lte: range.to };

  const [salesAgg, expensesByCategory, birdTotals, salesByDate, expensesByDate, birdTxByDate] =
    await Promise.all([
      prisma.eggSale.aggregate({
        where: { farmId, saleDate: dateFilter },
        _sum: { totalAmount: true, quantity: true },
      }),
      getExpensesByCategoryReport(farmId, range),
      getBirdTransactionTotals(farmId, range),
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
      // Both directions in one indexed scan; `type` decides which side of the
      // month bucket each row lands on.
      prisma.birdTransaction.groupBy({
        by: ["transactionDate", "type"],
        where: { farmId, transactionDate: dateFilter },
        _sum: { totalAmount: true },
      }),
    ]);

  const monthly = buildMonthlyTotals([
    ...salesByDate.map((row) => ({
      date: row.saleDate,
      incomeCents: toCents(row._sum.totalAmount),
    })),
    ...expensesByDate.map((row) => ({
      date: row.expenseDate,
      expensesCents: toCents(row._sum.amount),
    })),
    // Sold birds are income, bought birds an expense — same table, opposite
    // sides of the month row.
    ...birdTxByDate.map((row) =>
      row.type === "SALE"
        ? { date: row.transactionDate, incomeCents: toCents(row._sum.totalAmount) }
        : { date: row.transactionDate, expensesCents: toCents(row._sum.totalAmount) },
    ),
  ]);

  const eggIncomeCents = toCents(salesAgg._sum.totalAmount);
  const birdIncomeCents = toCents(birdTotals.salesAmount);
  const birdPurchaseCents = toCents(birdTotals.purchaseAmount);
  const incomeCents = eggIncomeCents + birdIncomeCents;
  const expensesCents =
    Object.values(expensesByCategory).reduce((sum, value) => sum + toCents(value), 0) +
    birdPurchaseCents;

  return {
    income: incomeCents / 100,
    expenses: expensesCents / 100,
    profit: (incomeCents - expensesCents) / 100,
    eggsSold: salesAgg._sum.quantity ?? 0,
    eggSalesIncome: eggIncomeCents / 100,
    birdSalesIncome: birdIncomeCents / 100,
    birdsSold: birdTotals.birdsSold,
    birdPurchaseCost: birdPurchaseCents / 100,
    birdsBought: birdTotals.birdsBought,
    expensesByCategory,
    monthly,
  };
}

/**
 * Earliest year that has any financial record, used to bound the year filter.
 * Falls back to the current year when the farm has no records yet.
 */
export async function getEarliestFinanceYear(farmId: string): Promise<number> {
  const [firstSale, firstExpense, firstBirdTransaction] = await Promise.all([
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
    prisma.birdTransaction.findFirst({
      where: { farmId },
      orderBy: { transactionDate: "asc" },
      select: { transactionDate: true },
    }),
  ]);

  const years = [
    firstSale?.saleDate,
    firstExpense?.expenseDate,
    firstBirdTransaction?.transactionDate,
  ]
    .filter((date): date is Date => date != null)
    .map((date) => date.getUTCFullYear());

  return years.length > 0 ? Math.min(...years) : new Date().getUTCFullYear();
}
