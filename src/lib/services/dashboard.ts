import { prisma } from "@/lib/prisma";
import { resolveFinancePeriod } from "@/lib/finance-period";

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

  const [collected, sold, eaten, birds, activeCycles, losses] = await Promise.all([
    prisma.eggCollection.aggregate({ where: { farmId }, _sum: { quantity: true } }),
    prisma.eggSale.aggregate({ where: { farmId }, _sum: { quantity: true } }),
    prisma.eggConsumption.aggregate({ where: { farmId }, _sum: { quantity: true } }),
    prisma.birdGroup.aggregate({ where: { farmId }, _sum: { quantity: true } }),
    prisma.incubationCycle.count({ where: { farmId, hatchDate: null } }),
    prisma.loss.aggregate({
      where: { farmId, lossDate: { gte: year.from, lte: year.to } },
      _sum: { quantity: true },
    }),
  ]);

  return {
    eggStock:
      (collected._sum.quantity ?? 0) - (sold._sum.quantity ?? 0) - (eaten._sum.quantity ?? 0),
    totalBirds: birds._sum.quantity ?? 0,
    activeCycles,
    losses: { year: year.year, count: losses._sum.quantity ?? 0 },
  };
}
