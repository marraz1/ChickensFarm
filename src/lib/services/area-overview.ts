import { prisma } from "@/lib/prisma";
import { resolveFinancePeriod } from "@/lib/finance-period";
import { birdGroupLabel, cycleLabel } from "@/lib/labels";
import {
  cycleCardLines,
  cycleStatus,
  flockByBreed,
  flockByGroup,
  hatchEfficiency,
  henStatus,
  sittingDay,
  type CycleStatus,
  type FlockPart,
  type HenStatus,
} from "@/lib/area-overview";
import { getAreaFinance, getAreaFinances } from "@/lib/services/area-finance";
import { openBroodsWhere } from "@/lib/services/mother-hens";
import type { AreaFinance } from "@/lib/area-finance";
import type { EggsStatKey, MeatStatKey } from "@/lib/v2-navigation";

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
  /** Every hen; living first (newest first), then the dead with "Nugaišusi", latest death first. */
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
      where: openBroodsWhere(farmId),
      select: { motherHenId: true, eggsTotal: true, startDate: true },
    }),
    getAreaFinance(farmId, "HENS", year),
  ]);
  // Counted in the database, per hen, through the farm's own hen ids: diary
  // entries carry no farmId, so the hens are read first.
  const logCounts =
    hens.length === 0
      ? []
      : await prisma.motherHenLog.groupBy({
          by: ["motherHenId"],
          where: { motherHenId: { in: hens.map((h) => h.id) } },
          _count: { _all: true },
        });
  const logsOf = new Map(logCounts.map((row) => [row.motherHenId, row._count._all]));
  // One open brood per hen is the rule (createIncubationCycle); should the data
  // ever hold more, her latest one is shown, never an arbitrary one.
  const cycleOf = new Map<string | null, (typeof activeCycles)[number]>();
  for (const c of [...activeCycles].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())) {
    cycleOf.set(c.motherHenId, c);
  }

  // Newest first; sorted here too because the test double ignores orderBy.
  const ordered = [...hens].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const living = ordered.filter((h) => !h.diedAt);
  // The most recently died first.
  const dead = hens
    .filter((h) => h.diedAt)
    .sort((a, b) => b.diedAt!.getTime() - a.diedAt!.getTime());

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
    cards: [...living, ...dead].map((h) => ({
      id: h.id,
      name: h.name,
      photoUrl: h.photoUrl,
      status: henStatus(h, cycleOf.has(h.id)),
      logs: logsOf.get(h.id) ?? 0,
    })),
    balance,
  };
}

export type CycleCard = {
  id: string;
  name: string;
  status: CycleStatus;
  lines: ReturnType<typeof cycleCardLines>;
};

export type IncubationOverview = {
  year: number;
  /** Cycles not hatched yet, and the eggs in them (under a hen included). */
  active: { count: number; eggs: number };
  efficiency: ReturnType<typeof hatchEfficiency>;
  /** Running cycles first, then the newest start. */
  cards: CycleCard[];
  /** For the sheet's per-cycle actions (incubationSheetItems). */
  sheet: { active: string[]; growing: string[] };
  balance: AreaFinance;
};

/**
 * The Perinimas area home (#189, V2-Inc-Overview). Day counts use the farm's
 * today (Europe/Vilnius). Farm-scoped throughout.
 */
export async function getIncubationAreaOverview(
  farmId: string,
  now: Date = new Date(),
): Promise<IncubationOverview> {
  const year = resolveFinancePeriod({}, now);

  const [cycles, balance] = await Promise.all([
    prisma.incubationCycle.findMany({
      where: { farmId },
      include: {
        eggSourceGroup: { select: { breed: { select: { name: true } } } },
        motherHen: { select: { name: true } },
        // Latest first; two entries on one day → the one written last.
        growthLogs: {
          select: { aliveCount: true },
          orderBy: [{ logDate: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
      },
    }),
    getAreaFinance(farmId, "INC", year),
  ]);

  // Running first, then the newest start; sorted here because the test
  // double ignores orderBy.
  const ordered = [...cycles].sort(
    (a, b) =>
      Number(!!a.hatchDate) - Number(!!b.hatchDate) ||
      b.startDate.getTime() - a.startDate.getTime(),
  );
  const running = ordered.filter((c) => !c.hatchDate);

  return {
    year: year.year,
    active: {
      count: running.length,
      // Once candled the infertile eggs are taken out: only fertile ones remain.
      eggs: running.reduce((sum, c) => sum + (c.eggsFertile ?? c.eggsTotal ?? 0), 0),
    },
    efficiency: hatchEfficiency(cycles),
    cards: ordered.map((c) => ({
      id: c.id,
      // Cycles from before names were required: "Ciklas nuo <date>", so the
      // title does not repeat the "Pradėta …" line under it.
      name: cycleLabel(c),
      status: cycleStatus(c),
      lines: cycleCardLines(
        {
          ...c,
          // Optional chaining: a link can be gone (SetNull) and tests use a
          // fake that returns rows without their relations.
          henName: c.motherHen?.name ?? null,
          sourceBreed: c.eggSourceGroup?.breed.name ?? null,
          latestAlive: c.growthLogs?.[0]?.aliveCount ?? null,
        },
        year.today,
      ),
    })),
    sheet: {
      active: running.map((c) => c.id),
      // Being raised: hatched with chicks, raising not finished. A hatch of 0
      // chicks can never be finished, so it would otherwise stay here forever.
      growing: ordered
        .filter((c) => c.hatchDate && !c.growthCompletedAt && (c.hatchedCount ?? 0) > 0)
        .map((c) => c.id),
    },
    balance,
  };
}

/** How many meat-use records "Paskutiniai įrašai" lists. */
const RECENT_MEAT_USE = 5;

export type MeatOverview = {
  year: number;
  /** Birds in Mėsa groups, and the same split by group. */
  raising: { total: number; byGroup: FlockPart[] };
  /** Mėsa birds used at home, this month and this year. */
  homeUse: { month: number; year: number };
  /** The year's Mėsa result, as the Finansai tab shows it. */
  balance: AreaFinance;
  /** The "Įrašai" figures, this year, keyed as AREA_RECORD_LINKS.meat names them. */
  stats: Record<MeatStatKey, number>;
  /** The latest meat-use records, newest first. */
  recent: { id: string; date: Date; groupLabel: string; quantity: number }[];
};

/**
 * The Mėsa area home (#190, V2-Meat-Overview). Meat use counts the Mėsa
 * groups' consumptions, as the Finansai tab's home use does (a consumption
 * goes by its group's current area), so the two screens always agree.
 * Farm-scoped throughout.
 */
export async function getMeatOverview(
  farmId: string,
  now: Date = new Date(),
): Promise<MeatOverview> {
  const year = resolveFinancePeriod({}, now);
  const month = resolveFinancePeriod({ period: "month" }, now);

  const [groups, breeds, [balance, monthMoney]] = await Promise.all([
    prisma.birdGroup.findMany({
      where: { farmId, area: "MEAT" },
      select: { id: true, name: true, quantity: true, breedId: true },
    }),
    prisma.breed.findMany({ where: { farmId }, select: { id: true, name: true } }),
    getAreaFinances(farmId, "MEAT", [year, month]),
  ]);

  const breedName = new Map(breeds.map((b) => [b.id, b.name]));
  const labelOf = new Map(
    groups.map((g) => [
      g.id,
      birdGroupLabel({ name: g.name, breed: { name: breedName.get(g.breedId) ?? "—" } })!,
    ]),
  );
  // Read after the groups: a consumption carries the group, not its area.
  const consumptions =
    groups.length === 0
      ? []
      : await prisma.birdConsumption.findMany({
          where: { farmId, birdGroupId: { in: groups.map((g) => g.id) } },
          select: {
            id: true,
            birdGroupId: true,
            consumptionDate: true,
            quantity: true,
            createdAt: true,
          },
          orderBy: [{ consumptionDate: "desc" }, { createdAt: "desc" }],
          take: RECENT_MEAT_USE,
        });

  const byGroup = flockByGroup(
    groups.map((g) => ({ quantity: g.quantity, label: labelOf.get(g.id)! })),
  );

  return {
    year: year.year,
    raising: { total: byGroup.reduce((sum, part) => sum + part.quantity, 0), byGroup },
    homeUse: { month: monthMoney.homeUse, year: balance.homeUse },
    balance,
    stats: {
      // Sold-out groups hold no birds: counted, they would disagree with the card.
      groups: groups.filter((g) => g.quantity > 0).length,
      consumed: balance.homeUse,
      sales: balance.birdIncome,
    },
    // Newest first, sorted and cut here too because the test double ignores
    // orderBy and take.
    recent: [...consumptions]
      .sort(
        (a, b) =>
          b.consumptionDate.getTime() - a.consumptionDate.getTime() ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      )
      .slice(0, RECENT_MEAT_USE)
      .map((c) => ({
        id: c.id,
        date: c.consumptionDate,
        groupLabel: labelOf.get(c.birdGroupId) ?? "—",
        quantity: c.quantity,
      })),
  };
}
