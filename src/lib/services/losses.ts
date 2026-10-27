import { prisma } from "@/lib/prisma";
import { adjustBirdGroupQuantityTx } from "@/lib/services/bird-groups";
import { ValidationError } from "@/lib/errors";
import {
  resolveTargetArea,
  sameTarget,
  targetFromInput,
  type Target,
} from "@/lib/services/farm-areas";
import type { Prisma } from "@/generated/prisma/client";
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

export function getLoss(farmId: string, id: string) {
  return prisma.loss.findFirst({ where: { id, farmId } });
}

// A mother hen is one bird, so a loss against her is always exactly one.
function assertHenLossQuantity(target: Target, quantity: number) {
  if (target.motherHenId && quantity !== 1) {
    throw new ValidationError("Perekšlės nuostolio kiekis turi būti 1");
  }
}

// A loss targets at most one of a bird group, a mother hen or an incubation
// cycle, and takes its area from that target (stored, see the Loss model).
// Only a bird-group loss moves a head count; hens and cycles have none.
export async function createLoss(farmId: string, userId: string, input: CreateLossInput) {
  const target = targetFromInput(input);
  assertHenLossQuantity(target, input.quantity);

  return prisma.$transaction(async (tx) => {
    const area = await resolveTargetArea(tx, farmId, target);
    const loss = await tx.loss.create({
      data: {
        farmId,
        ...target,
        area,
        lossDate: new Date(input.lossDate),
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
    // Same target → keep the stored area: the group may since have moved to
    // another area, but the loss happened where it was at the time. A row
    // with a target but no area yet (written before areas existed) gets one.
    const area =
      sameTarget(target, loss) && loss.area
        ? loss.area
        : await resolveTargetArea(tx, farmId, target);
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

    return tx.loss.update({
      where: { id: lossId },
      data: {
        lossDate: new Date(input.lossDate),
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
