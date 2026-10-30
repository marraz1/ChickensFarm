import { prisma } from "@/lib/prisma";
import { resolveFinancePeriod } from "@/lib/finance-period";
import { getEggStock } from "@/lib/services/egg-sales";

export type FarmNow = {
  /** Eggs on hand: all ever collected, minus sold and eaten. */
  eggStock: number;
  /** Birds in every group of the farm. */
  totalBirds: number;
  /** Incubation cycles not hatched yet, as the Perinimas area counts them. */
  activeCycles: number;
  /** Birds lost this year (the farm's, Europe/Vilnius), whatever their area. */
  losses: { year: number; count: number };
};

/**
 * The overview's "Ūkis dabar" boxes (#204, V2-Overview): the farm as it is
 * now, whatever period the page shows. Farm-scoped throughout.
 */
export async function getFarmNow(farmId: string, now: Date = new Date()): Promise<FarmNow> {
  const year = resolveFinancePeriod({}, now);

  const [eggStock, birds, activeCycles, losses] = await Promise.all([
    getEggStock(farmId),
    prisma.birdGroup.aggregate({ where: { farmId }, _sum: { quantity: true } }),
    prisma.incubationCycle.count({ where: { farmId, hatchDate: null } }),
    prisma.loss.aggregate({
      where: { farmId, lossDate: { gte: year.from, lte: year.to } },
      _sum: { quantity: true },
    }),
  ]);

  return {
    eggStock,
    totalBirds: birds._sum.quantity ?? 0,
    activeCycles,
    losses: { year: year.year, count: losses._sum.quantity ?? 0 },
  };
}
