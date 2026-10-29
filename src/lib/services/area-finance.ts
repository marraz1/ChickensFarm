import { prisma } from "@/lib/prisma";
import { buildAreaFinance, type AreaFinance } from "@/lib/area-finance";
import type { FarmArea } from "@/generated/prisma/client";

/**
 * One area's money over a period (#198), farm-scoped throughout. "SHARED"
 * gives Bendra: its expenses and no income, which is what the farm overview
 * (#201) adds to the four areas to reach the farm total.
 *
 * Grouped by day in the database (the tables are indexed on [farmId, <date>]
 * and [farmId, area]); the pure builder folds the days into months.
 */
export async function getAreaFinance(
  farmId: string,
  area: FarmArea,
  period: { from: Date; to: Date; today: Date },
): Promise<AreaFinance> {
  const dateRange = { gte: period.from, lte: period.to };

  const [eggSales, birdTransactions, expenses, homeUse] = await Promise.all([
    // Egg sales are Kiaušiniai income and nobody else's.
    area === "EGGS"
      ? prisma.eggSale.groupBy({
          by: ["saleDate"],
          where: { farmId, saleDate: dateRange },
          _sum: { totalAmount: true },
        })
      : Promise.resolve([]),
    // Sales and purchases by the area stored on them, so moving a group
    // later never re-files its past sales (#198).
    prisma.birdTransaction.groupBy({
      by: ["transactionDate", "type"],
      where: { farmId, area, transactionDate: dateRange },
      _sum: { totalAmount: true, quantity: true },
    }),
    prisma.expense.groupBy({
      by: ["expenseDate", "category"],
      where: { farmId, area, expenseDate: dateRange },
      _sum: { amount: true },
    }),
    getHomeUseCount(farmId, area, dateRange),
  ]);

  return buildAreaFinance({
    period,
    homeUse,
    eggSales: eggSales.map((row) => ({ date: row.saleDate, amount: row._sum.totalAmount })),
    birdTransactions: birdTransactions.map((row) => ({
      type: row.type,
      date: row.transactionDate,
      amount: row._sum.totalAmount,
      quantity: row._sum.quantity ?? 0,
    })),
    expenses: expenses.map((row) => ({
      date: row.expenseDate,
      category: row.category,
      amount: row._sum.amount,
    })),
  });
}

/**
 * Birds of the area's groups used for the household's meat — a count shown
 * beside the result, never income. Counted by the group's current area: a
 * group is moved to Mėsa before it is used for meat, and nothing is filed by it.
 */
async function getHomeUseCount(
  farmId: string,
  area: FarmArea,
  dateRange: { gte: Date; lte: Date },
): Promise<number> {
  const groups = await prisma.birdGroup.findMany({
    where: { farmId, area },
    select: { id: true },
  });
  if (groups.length === 0) return 0;
  const used = await prisma.birdConsumption.aggregate({
    where: {
      farmId,
      birdGroupId: { in: groups.map((g) => g.id) },
      consumptionDate: dateRange,
    },
    _sum: { quantity: true },
  });
  return used._sum.quantity ?? 0;
}
