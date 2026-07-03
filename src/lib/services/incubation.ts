import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/errors";
import { adjustBirdGroupQuantityTx } from "@/lib/services/bird-groups";
import type {
  CreateIncubationCycleInput,
  CandlingInput,
  HatchInput,
  CreateGrowthLogInput,
} from "@/lib/validation/incubation";

export function listIncubationCycles(farmId: string) {
  return prisma.incubationCycle.findMany({
    where: { farmId },
    include: {
      eggSourceGroup: { include: { breed: true } },
      growthLogs: { orderBy: { logDate: "desc" }, take: 1 },
    },
    // Active cycles (not yet hatched) first, then most recent.
    orderBy: [{ hatchDate: { sort: "asc", nulls: "first" } }, { startDate: "desc" }],
  });
}

export function getIncubationCycle(farmId: string, cycleId: string) {
  return prisma.incubationCycle.findFirst({
    where: { id: cycleId, farmId },
    include: {
      eggSourceGroup: { include: { breed: true } },
      resultingGroup: { include: { breed: true } },
      growthLogs: { orderBy: { logDate: "desc" } },
    },
  });
}

export async function createIncubationCycle(farmId: string, input: CreateIncubationCycleInput) {
  const eggSourceGroupId = input.eggSourceGroupId || null;
  if (eggSourceGroupId) {
    const group = await prisma.birdGroup.findFirst({ where: { id: eggSourceGroupId, farmId } });
    if (!group) throw new ValidationError("Pasirinkta kiaušinių šaltinio grupė nerasta");
  }

  return prisma.incubationCycle.create({
    data: {
      farmId,
      startDate: new Date(input.startDate),
      sourceDescription: input.sourceDescription || null,
      eggSourceGroupId,
      eggsTotal: input.eggsTotal ?? null,
      notes: input.notes || null,
    },
  });
}

// F10.2 — record candling results. Pure data update, no side effects, editable anytime.
export async function recordCandling(farmId: string, cycleId: string, input: CandlingInput) {
  const cycle = await prisma.incubationCycle.findFirst({ where: { id: cycleId, farmId } });
  if (!cycle) throw new ValidationError("Perinimo ciklas nerastas");

  return prisma.incubationCycle.update({
    where: { id: cycleId },
    data: { eggsFertile: input.eggsFertile, eggsInfertile: input.eggsInfertile },
  });
}

// F10.3 — finalize the hatch. One-time action: sets hatch data on the cycle and, if a
// target group is chosen, adds the hatched chicks to a bird group through the single
// audited quantity writer (records an INCUBATION_HATCH event).
export async function finalizeHatch(
  farmId: string,
  cycleId: string,
  userId: string,
  input: HatchInput
) {
  return prisma.$transaction(async (tx) => {
    const cycle = await tx.incubationCycle.findFirst({ where: { id: cycleId, farmId } });
    if (!cycle) throw new ValidationError("Perinimo ciklas nerastas");
    if (cycle.hatchDate) throw new ValidationError("Šis ciklas jau užbaigtas (išsiritimas registruotas)");

    let resultingGroupId: string | null = null;

    if (input.hatchedCount > 0 && input.target.mode !== "none") {
      if (input.target.mode === "new") {
        const breed = await tx.breed.findFirst({ where: { id: input.target.breedId, farmId } });
        if (!breed) throw new ValidationError("Pasirinkta veislė nerasta");

        // New day-old cohort, created at quantity 0 so the +hatchedCount shows up as a
        // single INCUBATION_HATCH event (rather than an INITIAL one).
        const cohort = await tx.birdGroup.create({
          data: {
            farmId,
            breedId: input.target.breedId,
            sex: "UNKNOWN",
            quantity: 0,
            birthOrAcquiredDate: new Date(input.hatchDate),
            notes: "Išsiritę jaunikliai (perinimas)",
          },
        });
        resultingGroupId = cohort.id;
      } else {
        const group = await tx.birdGroup.findFirst({
          where: { id: input.target.birdGroupId, farmId },
        });
        if (!group) throw new ValidationError("Pasirinkta paukščių grupė nerasta");
        resultingGroupId = group.id;
      }

      await adjustBirdGroupQuantityTx(tx, {
        birdGroupId: resultingGroupId,
        farmId,
        delta: input.hatchedCount,
        eventType: "INCUBATION_HATCH",
        sourceType: "incubation_cycle",
        sourceId: cycleId,
        note: "Išsiritimas iš perinimo ciklo",
        userId,
      });
    }

    return tx.incubationCycle.update({
      where: { id: cycleId },
      data: {
        hatchDate: new Date(input.hatchDate),
        hatchedCount: input.hatchedCount,
        resultingGroupId,
      },
    });
  });
}

// F10.4 — periodic survival update for the hatched chicks.
export async function addGrowthLog(farmId: string, cycleId: string, input: CreateGrowthLogInput) {
  const cycle = await prisma.incubationCycle.findFirst({ where: { id: cycleId, farmId } });
  if (!cycle) throw new ValidationError("Perinimo ciklas nerastas");

  return prisma.incubationGrowthLog.create({
    data: {
      incubationCycleId: cycleId,
      logDate: new Date(input.logDate),
      aliveCount: input.aliveCount,
      note: input.note || null,
    },
  });
}

// F10.5 — per-cycle efficiency, all divide-by-zero guarded (null = "not enough data yet").
export type CycleStats = {
  fertilityRate: number | null; // fertile / total eggs
  hatchRate: number | null; // hatched / fertile
  survivalRate: number | null; // latest alive / hatched
  latestAlive: number | null;
};

export function computeCycleStats(cycle: {
  eggsTotal: number | null;
  eggsFertile: number | null;
  hatchedCount: number | null;
  growthLogs: { aliveCount: number }[];
}): CycleStats {
  const latestAlive = cycle.growthLogs.length > 0 ? cycle.growthLogs[0].aliveCount : null;
  return {
    fertilityRate:
      cycle.eggsTotal && cycle.eggsTotal > 0 && cycle.eggsFertile != null
        ? cycle.eggsFertile / cycle.eggsTotal
        : null,
    hatchRate:
      cycle.eggsFertile && cycle.eggsFertile > 0 && cycle.hatchedCount != null
        ? cycle.hatchedCount / cycle.eggsFertile
        : null,
    survivalRate:
      cycle.hatchedCount && cycle.hatchedCount > 0 && latestAlive != null
        ? latestAlive / cycle.hatchedCount
        : null,
    latestAlive,
  };
}

// F10.5 "bendrai" — farm-wide totals across all cycles.
export async function getIncubationOverview(farmId: string) {
  const agg = await prisma.incubationCycle.aggregate({
    where: { farmId },
    _sum: { eggsTotal: true, eggsFertile: true, hatchedCount: true },
  });
  const totalEggs = agg._sum.eggsTotal ?? 0;
  const totalFertile = agg._sum.eggsFertile ?? 0;
  const totalHatched = agg._sum.hatchedCount ?? 0;

  return {
    totalEggs,
    totalFertile,
    totalHatched,
    overallHatchRate: totalFertile > 0 ? totalHatched / totalFertile : null,
  };
}
