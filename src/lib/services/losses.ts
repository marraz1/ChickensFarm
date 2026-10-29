import { prisma } from "@/lib/prisma";
import { adjustBirdGroupQuantityTx } from "@/lib/services/bird-groups";
import { assertDiedAtNotFuture } from "@/lib/services/mother-hens";
import { ValidationError } from "@/lib/errors";
import {
  resolveTargetArea,
  sameTarget,
  targetFromInput,
  type Target,
} from "@/lib/services/farm-areas";
import { birdGroupLabel, cycleLabel, lossReasonLabels } from "@/lib/labels";
import {
  AREA_LOSS_LIST_LIMIT,
  buildAreaLossSummary,
  type AreaLossSummary,
} from "@/lib/area-losses";
import { currentYearLT } from "@/lib/format";
import type { FarmArea, Prisma } from "@/generated/prisma/client";
import type { CreateLossInput } from "@/lib/validation/losses";
import type { LossReasonType } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

export function listLosses(farmId: string) {
  return prisma.loss.findMany({
    where: { farmId },
    include: { birdGroup: { include: { breed: true } } },
    orderBy: { lossDate: "desc" },
  });
}

/** An area's Nuostoliai tab (#196): its losses, counted by cause for the year. */
export async function getAreaLosses(
  farmId: string,
  area: Exclude<FarmArea, "SHARED">,
  options: { now?: Date; linkQuery?: string } = {},
): Promise<AreaLossSummary> {
  const year = currentYearLT(options.now);
  const [yearGroups, losses] = await Promise.all([
    // The card: this year's birds per cause, counted in the database.
    prisma.loss.groupBy({
      by: ["reasonType"],
      where: {
        farmId,
        area,
        lossDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
      _sum: { quantity: true },
    }),
    // The list: the newest records only, plus one to tell there are more.
    prisma.loss.findMany({
      where: { farmId, area },
      include: {
        birdGroup: { select: { name: true, breed: { select: { name: true } } } },
        motherHen: { select: { name: true } },
        incubationCycle: { select: { name: true, startDate: true } },
      },
      orderBy: [{ lossDate: "desc" }, { createdAt: "desc" }],
      take: AREA_LOSS_LIST_LIMIT + 1,
    }),
  ]);

  return buildAreaLossSummary({
    year,
    yearCounts: Object.fromEntries(yearGroups.map((g) => [g.reasonType, g._sum.quantity ?? 0])),
    linkQuery: options.linkQuery,
    losses: losses.map((l) => ({
      id: l.id,
      reasonType: l.reasonType,
      quantity: l.quantity,
      lossDate: l.lossDate,
      createdAt: l.createdAt,
      comment: l.comment,
      // Optional chaining: a target can be gone (SetNull) and tests use a
      // fake that returns rows without their relations.
      targetName:
        birdGroupLabel(l.birdGroup) ||
        l.motherHen?.name ||
        (l.incubationCycle ? cycleLabel(l.incubationCycle) : null),
    })),
  });
}

export function getLoss(farmId: string, id: string) {
  return prisma.loss.findFirst({
    where: { id, farmId },
    include: {
      motherHen: { select: { name: true } },
      incubationCycle: { select: { name: true, startDate: true } },
    },
  });
}

// A mother hen is one bird, so a loss against her is always exactly one.
function assertHenLossQuantity(target: Target, quantity: number) {
  if (target.motherHenId && quantity !== 1) {
    throw new ValidationError("Perekšlės nuostolio kiekis turi būti 1");
  }
}

/**
 * The area a loss's target belongs to, checked against the area the form was
 * opened from (#195): a loss recorded from Kiaušiniai cannot land on a Mėsa
 * group. Farm scoping is resolveTargetArea's (another farm's id → 400).
 */
async function resolveLossArea(
  tx: TxClient,
  farmId: string,
  target: Target,
  expectedArea: CreateLossInput["area"],
) {
  const area = await resolveTargetArea(tx, farmId, target);
  if (expectedArea && area !== expectedArea) {
    throw new ValidationError("Pasirinktas įrašas priklauso kitai sričiai");
  }
  return area;
}

// ---- Mother hens: a loss is her death (#195) --------------------------------

async function markHenDeadTx(tx: TxClient, farmId: string, henId: string, lossDate: string) {
  const hen = await tx.motherHen.findFirst({ where: { id: henId, farmId } });
  if (!hen) throw new ValidationError("Pasirinkta perekšlė nerasta");
  if (hen.diedAt) throw new ValidationError("Ši perekšlė jau pažymėta kaip nugaišusi");
  assertDiedAtNotFuture(lossDate);
  await tx.motherHen.update({ where: { id: henId }, data: { diedAt: new Date(lossDate) } });
}

/**
 * Whether this loss is what marked the hen dead: her death date is the loss
 * date. A loss recorded before #195 left her alive, and a death recorded on
 * her own form may be another day; neither is this loss's to move or undo.
 */
async function henDiedOfLossTx(
  tx: TxClient,
  farmId: string,
  loss: { motherHenId: string; lossDate: Date },
) {
  const hen = await tx.motherHen.findFirst({ where: { id: loss.motherHenId, farmId } });
  return hen?.diedAt?.getTime() === loss.lossDate.getTime();
}

// ---- Incubation cycles: a loss lowers the live chick count (#195) -----------
//
// Both places that hold it move together, as decided on #195: a growth entry
// with the lower live count (what the cycle page shows as "dabar gyvų") and
// the hatched group's head count (with its history event).
//
// The growth entry takes the loss's id as its own, so deleting the loss finds
// exactly the entry it wrote (a loss recorded before #195 has none, and had
// no effect to undo). A backdated loss also lowers every later entry, so the
// latest one, the live count, always reflects it.

type GrowthLog = { id: string; logDate: Date; createdAt: Date; aliveCount: number };

// Oldest first, by date, then by when it was written: the same order the
// cycle pages read (incubation.ts). Sorted in code because the tests'
// in-memory Prisma ignores orderBy; a cycle has a handful of entries.
function byGrowthOrder(a: GrowthLog, b: GrowthLog) {
  return a.logDate.getTime() - b.logDate.getTime() || a.createdAt.getTime() - b.createdAt.getTime();
}

async function growthLogsTx(tx: TxClient, cycleId: string): Promise<GrowthLog[]> {
  const logs = await tx.incubationGrowthLog.findMany({ where: { incubationCycleId: cycleId } });
  return logs.sort(byGrowthOrder);
}

async function shiftGrowthLogsTx(tx: TxClient, logs: GrowthLog[], delta: number) {
  for (const log of logs) {
    await tx.incubationGrowthLog.update({
      where: { id: log.id },
      data: { aliveCount: log.aliveCount + delta },
    });
  }
}

async function findCycleTx(tx: TxClient, farmId: string, cycleId: string) {
  const cycle = await tx.incubationCycle.findFirst({ where: { id: cycleId, farmId } });
  if (!cycle) throw new ValidationError("Pasirinktas perinimo ciklas nerastas");
  return cycle;
}

async function recordCycleLossTx(
  tx: TxClient,
  farmId: string,
  userId: string,
  loss: { id: string; incubationCycleId: string; quantity: number; lossDate: Date },
  note: string,
) {
  const cycle = await findCycleTx(tx, farmId, loss.incubationCycleId);
  if (cycle.hatchedCount == null) {
    throw new ValidationError("Šis ciklas dar neturi išsiritusių jauniklių");
  }
  if (cycle.growthCompletedAt) throw new ValidationError("Sekimas jau užbaigtas");

  // Alive on the loss date: the last entry up to that day, else what hatched.
  // Every later entry drops too, and none of them may go below zero.
  const logs = await growthLogsTx(tx, cycle.id);
  const day = loss.lossDate.getTime();
  const earlier = logs.filter((l) => l.logDate.getTime() <= day);
  const later = logs.filter((l) => l.logDate.getTime() > day);
  const aliveThen = earlier.at(-1)?.aliveCount ?? cycle.hatchedCount;
  if ([aliveThen, ...later.map((l) => l.aliveCount)].some((alive) => loss.quantity > alive)) {
    throw new ValidationError("Nuostolis didesnis nei gyvų jauniklių skaičius");
  }
  await tx.incubationGrowthLog.create({
    data: {
      id: loss.id,
      incubationCycleId: cycle.id,
      logDate: loss.lossDate,
      aliveCount: aliveThen - loss.quantity,
      note,
    },
  });
  await shiftGrowthLogsTx(tx, later, -loss.quantity);
  if (cycle.resultingGroupId) {
    await adjustBirdGroupQuantityTx(tx, {
      birdGroupId: cycle.resultingGroupId,
      farmId,
      delta: -loss.quantity,
      eventType: "LOSS",
      sourceType: "loss",
      sourceId: loss.id,
      note,
      userId,
    });
  }
}

/**
 * Undoes a cycle loss: removes its growth entry, gives every later entry the
 * chicks back, and returns the birds to the hatched group. Refused once
 * tracking is finished: the group's birds have been handed on by then.
 */
async function undoCycleLossTx(
  tx: TxClient,
  farmId: string,
  userId: string,
  loss: { id: string; incubationCycleId: string; quantity: number },
) {
  const cycle = await findCycleTx(tx, farmId, loss.incubationCycleId);
  const logs = await growthLogsTx(tx, cycle.id);
  const index = logs.findIndex((l) => l.id === loss.id);
  if (index === -1) return; // recorded before #195: it changed nothing
  if (cycle.growthCompletedAt) {
    throw new ValidationError("Sekimas jau užbaigtas, šio nuostolio ištrinti negalima");
  }

  await tx.incubationGrowthLog.delete({ where: { id: loss.id } });
  await shiftGrowthLogsTx(tx, logs.slice(index + 1), loss.quantity);
  if (cycle.resultingGroupId) {
    await adjustBirdGroupQuantityTx(tx, {
      birdGroupId: cycle.resultingGroupId,
      farmId,
      delta: loss.quantity,
      eventType: "MANUAL_ADJUSTMENT",
      sourceType: "loss",
      sourceId: loss.id,
      note: "Nuostolio įrašas ištrintas",
      userId,
    });
  }
}

function lossNote(input: { reasonType: LossReasonType; comment?: string | null }) {
  const reason = lossReasonLabels[input.reasonType];
  return input.comment ? `Nuostolis · ${reason}: ${input.comment}` : `Nuostolis · ${reason}`;
}

// A loss targets at most one of a bird group, a mother hen or an incubation
// cycle, and takes its area from that target (stored, see the Loss model).
// A group loss moves the group's head count; a hen loss marks her dead; a
// cycle loss lowers its live chick count and the hatched group's (#195).
export async function createLoss(farmId: string, userId: string, input: CreateLossInput) {
  const target = targetFromInput(input);
  assertHenLossQuantity(target, input.quantity);

  return prisma.$transaction(async (tx) => {
    const area = await resolveLossArea(tx, farmId, target, input.area);
    const lossDate = new Date(input.lossDate);
    const loss = await tx.loss.create({
      data: {
        farmId,
        ...target,
        area,
        lossDate,
        quantity: input.quantity,
        reasonType: input.reasonType,
        comment: input.comment || null,
      },
    });

    if (loss.birdGroupId) {
      await adjustBirdGroupQuantityTx(tx, {
        birdGroupId: loss.birdGroupId,
        farmId,
        delta: -input.quantity,
        eventType: "LOSS",
        sourceType: "loss",
        sourceId: loss.id,
        note: input.comment,
        userId,
      });
    }
    if (loss.motherHenId) await markHenDeadTx(tx, farmId, loss.motherHenId, input.lossDate);
    if (loss.incubationCycleId) {
      await recordCycleLossTx(
        tx,
        farmId,
        userId,
        {
          id: loss.id,
          incubationCycleId: loss.incubationCycleId,
          quantity: input.quantity,
          lossDate,
        },
        lossNote(input),
      );
    }

    return loss;
  });
}

// Restores the quantity a loss had removed from its linked group, as a
// compensating audit event (BirdGroup.quantity has a single writer, so we go
// through adjustBirdGroupQuantityTx rather than editing quantity directly).
async function restoreLossQuantityTx(
  tx: TxClient,
  farmId: string,
  userId: string,
  loss: { id: string; birdGroupId: string | null; quantity: number },
) {
  if (!loss.birdGroupId) return;
  await adjustBirdGroupQuantityTx(tx, {
    birdGroupId: loss.birdGroupId,
    farmId,
    delta: loss.quantity,
    eventType: "MANUAL_ADJUSTMENT",
    sourceType: "loss",
    sourceId: loss.id,
    note: "Nuostolio įrašo korekcija",
    userId,
  });
}

export async function updateLoss(
  farmId: string,
  lossId: string,
  userId: string,
  input: CreateLossInput,
) {
  return prisma.$transaction(async (tx) => {
    const loss = await tx.loss.findFirst({ where: { id: lossId, farmId } });
    if (!loss) throw new ValidationError("Nuostolio įrašas nerastas");

    const target = targetFromInput(input, loss);
    assertHenLossQuantity(target, input.quantity);

    const lossDate = new Date(input.lossDate);

    // A hen's or cycle's loss changed the hen or the cycle's growth record;
    // moving it elsewhere or changing its size cannot be re-applied safely.
    // Reason and comment stay editable, and a hen loss's date too (#195).
    if (loss.motherHenId || loss.incubationCycleId) {
      if (!sameTarget(target, loss) || input.quantity !== loss.quantity) {
        throw new ValidationError(
          "Perekšlės ar ciklo nuostolio objekto ir kiekio pakeisti negalima. Ištrinkite ir įrašykite iš naujo.",
        );
      }
    }
    // The cycle's growth history is dated by the loss.
    if (loss.incubationCycleId && lossDate.getTime() !== loss.lossDate.getTime()) {
      throw new ValidationError(
        "Ciklo nuostolio datos pakeisti negalima. Ištrinkite ir įrašykite iš naujo.",
      );
    }

    // Same target → keep the stored area: the group may since have moved to
    // another area, but the loss happened where it was at the time. A row
    // with a target but no area yet (written before areas existed) gets one.
    const area =
      sameTarget(target, loss) && loss.area
        ? loss.area
        : await resolveLossArea(tx, farmId, target, input.area);
    const newGroupId = target.birdGroupId;

    // Reconcile the group-quantity effect. Same group → apply just the net
    // change; group changed → give the old group its birds back and take the new
    // count from the new group.
    if (loss.birdGroupId === newGroupId) {
      const delta = loss.quantity - input.quantity; // >0 restores, <0 removes more
      if (newGroupId && delta !== 0) {
        await adjustBirdGroupQuantityTx(tx, {
          birdGroupId: newGroupId,
          farmId,
          delta,
          eventType: delta > 0 ? "MANUAL_ADJUSTMENT" : "LOSS",
          sourceType: "loss",
          sourceId: loss.id,
          note: "Nuostolio įrašo korekcija",
          userId,
        });
      }
    } else {
      await restoreLossQuantityTx(tx, farmId, userId, loss);
      if (newGroupId) {
        await adjustBirdGroupQuantityTx(tx, {
          birdGroupId: newGroupId,
          farmId,
          delta: -input.quantity,
          eventType: "LOSS",
          sourceType: "loss",
          sourceId: loss.id,
          note: input.comment,
          userId,
        });
      }
    }

    // A hen's death date follows the loss date, if this loss is her death.
    if (
      loss.motherHenId &&
      lossDate.getTime() !== loss.lossDate.getTime() &&
      (await henDiedOfLossTx(tx, farmId, {
        motherHenId: loss.motherHenId,
        lossDate: loss.lossDate,
      }))
    ) {
      assertDiedAtNotFuture(input.lossDate);
      await tx.motherHen.update({ where: { id: loss.motherHenId }, data: { diedAt: lossDate } });
    }

    return tx.loss.update({
      where: { id: lossId },
      data: {
        lossDate,
        quantity: input.quantity,
        reasonType: input.reasonType,
        ...target,
        area,
        comment: input.comment || null,
      },
    });
  });
}

export async function deleteLoss(farmId: string, lossId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const loss = await tx.loss.findFirst({ where: { id: lossId, farmId } });
    if (!loss) throw new ValidationError("Nuostolio įrašas nerastas");

    await restoreLossQuantityTx(tx, farmId, userId, loss);
    if (
      loss.motherHenId &&
      (await henDiedOfLossTx(tx, farmId, {
        motherHenId: loss.motherHenId,
        lossDate: loss.lossDate,
      }))
    ) {
      await tx.motherHen.updateMany({
        where: { id: loss.motherHenId, farmId },
        data: { diedAt: null },
      });
    }
    if (loss.incubationCycleId) {
      await undoCycleLossTx(tx, farmId, userId, {
        id: loss.id,
        incubationCycleId: loss.incubationCycleId,
        quantity: loss.quantity,
      });
    }
    await tx.loss.delete({ where: { id: lossId } });
  });
}

export async function getLossesByReasonReport(farmId: string, range: { from: Date; to: Date }) {
  const grouped = await prisma.loss.groupBy({
    by: ["reasonType"],
    where: { farmId, lossDate: { gte: range.from, lte: range.to } },
    _sum: { quantity: true },
  });

  const totals: Record<LossReasonType, number> = { DISEASE: 0, PREDATOR: 0, OTHER: 0 };
  for (const row of grouped) {
    totals[row.reasonType] = row._sum.quantity ?? 0;
  }
  return totals;
}
