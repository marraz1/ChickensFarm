import { prisma } from "@/lib/prisma";
import { resolveFinancePeriod } from "@/lib/finance-period";
import {
  flockByBreed,
  henStatus,
  sittingDay,
  type FlockPart,
  type HenStatus,
} from "@/lib/area-overview";
import { getAreaFinance, getAreaFinances } from "@/lib/services/area-finance";
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

export type HenCard = {
  id: string;
  name: string;
  photoUrl: string | null;
  status: HenStatus;
  /** Diary entries. */
  logs: number;
};

export type HensOverview = {
  year: number;
  /** Living hens, newest first (as the V1 list orders them). */
  hens: { id: string; name: string }[];
  /** Hens sitting now, each on her unhatched cycle. */
  sitting: { name: string; eggs: number | null; day: number }[];
  /** Every hen; living first, a dead hen kept with "Nugaišusi". */
  cards: HenCard[];
  balance: AreaFinance;
};

/**
 * The Perekšlės area home (#188, V2-Hens-Overview). A hen sits while she has
 * an incubation cycle with no hatch date yet; the day count uses the farm's
 * today (Europe/Vilnius). Farm-scoped throughout.
 */
export async function getHensOverview(
  farmId: string,
  now: Date = new Date(),
): Promise<HensOverview> {
  const year = resolveFinancePeriod({}, now);

  const [hens, activeCycles, balance] = await Promise.all([
    prisma.motherHen.findMany({
      where: { farmId },
      select: { id: true, name: true, photoUrl: true, diedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.incubationCycle.findMany({
      where: { farmId, hatchDate: null, motherHenId: { not: null } },
      select: { motherHenId: true, eggsTotal: true, startDate: true },
    }),
    getAreaFinance(farmId, "HENS", year),
  ]);
  // Counted per hen through the farm's own hen ids: logs carry no farmId. A
  // farm has a handful of hens with a diary each, so ids are enough to fetch.
  const logs =
    hens.length === 0
      ? []
      : await prisma.motherHenLog.findMany({
          where: { motherHenId: { in: hens.map((h) => h.id) } },
          select: { motherHenId: true },
        });
  const logsOf = new Map<string, number>();
  for (const log of logs) logsOf.set(log.motherHenId, (logsOf.get(log.motherHenId) ?? 0) + 1);
  const cycleOf = new Map(activeCycles.map((c) => [c.motherHenId, c]));

  // Newest first; sorted here too because the test double ignores orderBy.
  const ordered = [...hens].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const living = ordered.filter((h) => !h.diedAt);

  return {
    year: year.year,
    hens: living.map(({ id, name }) => ({ id, name })),
    sitting: living
      .filter((h) => cycleOf.has(h.id))
      .map((h) => {
        const cycle = cycleOf.get(h.id)!;
        return {
          name: h.name,
          eggs: cycle.eggsTotal,
          day: sittingDay(cycle.startDate, year.today),
        };
      }),
    cards: [...living, ...ordered.filter((h) => h.diedAt)].map((h) => ({
      id: h.id,
      name: h.name,
      photoUrl: h.photoUrl,
      status: henStatus(h, cycleOf.has(h.id)),
      logs: logsOf.get(h.id) ?? 0,
    })),
    balance,
  };
}
