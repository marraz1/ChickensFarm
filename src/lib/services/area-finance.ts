import { prisma } from "@/lib/prisma";
import { buildAreaFinance, type AreaFinance, type AreaFinanceInput } from "@/lib/area-finance";
import { farmAreaOrder } from "@/lib/labels";
import type { FarmArea } from "@/generated/prisma/client";

type Period = AreaFinanceInput["period"];
type Rows = Omit<AreaFinanceInput, "period">;

/**
 * The farm's money over a period, grouped by day and area in the database (the
 * tables are indexed on [farmId, <date>] and [farmId, area]); the pure builder
 * folds the days into months. With `area` the queries are narrowed to it,
 * without it one batch covers the whole farm. Farm-scoped throughout.
 */
async function fetchFinanceRows(
  farmId: string,
  period: Period,
  area?: FarmArea,
): Promise<Map<FarmArea, Rows>> {
  const dateRange = { gte: period.from, lte: period.to };
  const areaFilter = area ? { area } : {};

  const [eggSales, birdTransactions, expenses, groups, consumptions] = await Promise.all([
    // Egg sales are Kiaušiniai income and nobody else's.
    !area || area === "EGGS"
      ? prisma.eggSale.groupBy({
          by: ["saleDate"],
          where: { farmId, saleDate: dateRange },
          _sum: { totalAmount: true },
        })
      : Promise.resolve([]),
    // Sales and purchases by the area stored on them, so moving a group
    // later never re-files its past sales (#198).
    prisma.birdTransaction.groupBy({
      by: ["area", "transactionDate", "type"],
      where: { farmId, ...areaFilter, transactionDate: dateRange },
      _sum: { totalAmount: true, quantity: true },
    }),
    prisma.expense.groupBy({
      by: ["area", "expenseDate", "category"],
      where: { farmId, ...areaFilter, expenseDate: dateRange },
      _sum: { amount: true },
    }),
    // Meat used at home is a count shown beside the result, never income.
    // It goes by the group's current area: a group is moved to Mėsa before it
    // is used for meat, and nothing is filed by the count.
    prisma.birdGroup.findMany({
      where: { farmId, ...areaFilter },
      select: { id: true, area: true },
    }),
    prisma.birdConsumption.groupBy({
      by: ["birdGroupId", "consumptionDate"],
      where: { farmId, consumptionDate: dateRange },
      _sum: { quantity: true },
    }),
  ]);

  const byArea = new Map<FarmArea, Rows>();
  const rowsOf = (a: FarmArea) => {
    let rows = byArea.get(a);
    if (!rows)
      byArea.set(a, (rows = { eggSales: [], birdTransactions: [], expenses: [], homeUse: [] }));
    return rows;
  };

  for (const row of eggSales) {
    rowsOf("EGGS").eggSales.push({ date: row.saleDate, amount: row._sum.totalAmount });
  }
  for (const row of birdTransactions) {
    rowsOf(row.area).birdTransactions.push({
      type: row.type,
      date: row.transactionDate,
      amount: row._sum.totalAmount,
      quantity: row._sum.quantity ?? 0,
    });
  }
  for (const row of expenses) {
    rowsOf(row.area).expenses.push({
      date: row.expenseDate,
      category: row.category,
      amount: row._sum.amount,
    });
  }
  const groupArea = new Map(groups.map((g) => [g.id, g.area]));
  for (const row of consumptions) {
    const a = groupArea.get(row.birdGroupId);
    if (a) rowsOf(a).homeUse.push({ date: row.consumptionDate, quantity: row._sum.quantity ?? 0 });
  }
  return byArea;
}

const EMPTY: Rows = { eggSales: [], birdTransactions: [], expenses: [], homeUse: [] };

/**
 * One area's money over several periods from a single fetch spanning them all
 * (#187: the year's balance and this month's figures). Every row is dated, so
 * each period is built from just its own days — the same result as calling
 * getAreaFinance per period, with half the queries or fewer.
 */
export async function getAreaFinances(
  farmId: string,
  area: FarmArea,
  periods: readonly Period[],
): Promise<AreaFinance[]> {
  if (periods.length === 0) return [];
  const span: Period = {
    from: new Date(Math.min(...periods.map((p) => p.from.getTime()))),
    to: new Date(Math.max(...periods.map((p) => p.to.getTime()))),
    today: periods[0].today,
  };
  const rows = (await fetchFinanceRows(farmId, span, area)).get(area) ?? EMPTY;
  return periods.map((period) => buildAreaFinance({ ...rows, period }));
}

/**
 * One area's money over a period (#198). "SHARED" gives Bendra: its expenses
 * and no income.
 */
export async function getAreaFinance(
  farmId: string,
  area: FarmArea,
  period: Period,
): Promise<AreaFinance> {
  const rows = await fetchFinanceRows(farmId, period, area);
  return buildAreaFinance({ ...(rows.get(area) ?? EMPTY), period });
}

export type FarmFinance = {
  /** Kiaušiniai, Perekšlės, Perinimas, Mėsa and Bendra, each built as on its own tab. */
  areas: Record<FarmArea, AreaFinance>;
  /** The four areas plus Bendros išlaidos, summed in cents. */
  total: { income: number; expenses: number; result: number };
};

/**
 * The whole farm over a period (#201), from one query batch: every area as its
 * Finansai tab shows it, and the farm total as their sum — so the overview's
 * result always equals the area results plus Bendros išlaidos.
 */
export async function getFarmFinance(farmId: string, period: Period): Promise<FarmFinance> {
  const rows = await fetchFinanceRows(farmId, period);
  const areas = Object.fromEntries(
    farmAreaOrder.map((a) => [a, buildAreaFinance({ ...(rows.get(a) ?? EMPTY), period })]),
  ) as Record<FarmArea, AreaFinance>;

  const cents = (key: "income" | "expenses") =>
    farmAreaOrder.reduce((sum, a) => sum + Math.round(areas[a][key] * 100), 0);
  const incomeCents = cents("income");
  const expensesCents = cents("expenses");
  return {
    areas,
    total: {
      income: incomeCents / 100,
      expenses: expensesCents / 100,
      result: (incomeCents - expensesCents) / 100,
    },
  };
}
