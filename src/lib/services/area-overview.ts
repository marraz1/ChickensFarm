import { prisma } from "@/lib/prisma";
import { resolveFinancePeriod } from "@/lib/finance-period";
import { flockByBreed, type FlockPart } from "@/lib/area-overview";
import { getAreaFinances } from "@/lib/services/area-finance";
import type { AreaFinance } from "@/lib/area-finance";
import type { EggsStatKey } from "@/lib/v2-navigation";

export type EggsOverview = {
  year: number;
  /** Eggs on hand: all ever collected, minus sold and eaten. */
  eggStock: number;
  collectedThisMonth: number;
  collectedThisYear: number;
  /** Birds in Kiaušiniai groups, and the same split by breed. */
  flock: { total: number; byBreed: FlockPart[]; groups: number };
  /** The year's Kiaušiniai result, as the Finansai tab shows it. */
  balance: AreaFinance;
  /** The "Įrašai" figures, this month, keyed as AREA_RECORD_LINKS.eggs names them. */
  stats: Record<EggsStatKey, number>;
};

/**
 * The Kiaušiniai area home (#187, V2-Eggs-Overview). "This month" and "this
 * year" are the farm's (Europe/Vilnius), the same periods the Finansai tab
 * offers; money comes from the same finance rows (one fetch for both periods),
 * so the two screens always agree.
 * Farm-scoped throughout.
 */
export async function getEggsOverview(
  farmId: string,
  now: Date = new Date(),
): Promise<EggsOverview> {
  const year = resolveFinancePeriod({}, now);
  const month = resolveFinancePeriod({ period: "month" }, now);
  const monthRange = { gte: month.from, lte: month.to };
  const yearRange = { gte: year.from, lte: year.to };

  const [
    collectedAll,
    soldAll,
    consumedAll,
    collectedMonth,
    collectedYear,
    consumedMonth,
    groups,
    breeds,
    [balance, monthMoney],
  ] = await Promise.all([
    prisma.eggCollection.aggregate({ where: { farmId }, _sum: { quantity: true } }),
    prisma.eggSale.aggregate({ where: { farmId }, _sum: { quantity: true } }),
    prisma.eggConsumption.aggregate({ where: { farmId }, _sum: { quantity: true } }),
    prisma.eggCollection.aggregate({
      where: { farmId, collectionDate: monthRange },
      _sum: { quantity: true },
    }),
    prisma.eggCollection.aggregate({
      where: { farmId, collectionDate: yearRange },
      _sum: { quantity: true },
    }),
    prisma.eggConsumption.aggregate({
      where: { farmId, consumptionDate: monthRange },
      _sum: { quantity: true },
    }),
    prisma.birdGroup.findMany({
      where: { farmId, area: "EGGS" },
      select: { quantity: true, breedId: true },
    }),
    prisma.breed.findMany({ where: { farmId }, select: { id: true, name: true } }),
    getAreaFinances(farmId, "EGGS", [year, month]),
  ]);

  const breedName = new Map(breeds.map((b) => [b.id, b.name]));
  const byBreed = flockByBreed(
    groups.map((g) => ({ quantity: g.quantity, breedName: breedName.get(g.breedId) ?? "—" })),
  );
  const collectedThisMonth = collectedMonth._sum.quantity ?? 0;
  // Sold-out groups stay in the list but hold no birds: counting them would
  // disagree with the flock card next to it.
  const activeGroups = groups.filter((g) => g.quantity > 0).length;

  return {
    year: year.year,
    eggStock:
      (collectedAll._sum.quantity ?? 0) -
      (soldAll._sum.quantity ?? 0) -
      (consumedAll._sum.quantity ?? 0),
    collectedThisMonth,
    collectedThisYear: collectedYear._sum.quantity ?? 0,
    flock: {
      total: byBreed.reduce((sum, part) => sum + part.quantity, 0),
      byBreed,
      groups: activeGroups,
    },
    balance,
    stats: {
      collected: collectedThisMonth,
      eggSales: monthMoney.eggIncome,
      eggsConsumed: consumedMonth._sum.quantity ?? 0,
      purchases: monthMoney.purchases,
      birdSales: monthMoney.birdIncome,
      groups: activeGroups,
    },
  };
}
