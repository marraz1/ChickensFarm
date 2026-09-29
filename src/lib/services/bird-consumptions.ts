import { prisma } from "@/lib/prisma";
import { adjustBirdGroupQuantityTx } from "@/lib/services/bird-groups";
import { ValidationError } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";
import type { CreateBirdConsumptionInput } from "@/lib/validation/bird-consumptions";

type TxClient = Prisma.TransactionClient;

export function listBirdConsumptions(farmId: string) {
  return prisma.birdConsumption.findMany({
    where: { farmId },
    include: { birdGroup: { include: { breed: true } } },
    orderBy: { consumptionDate: "desc" },
  });
}

export function getBirdConsumption(farmId: string, id: string) {
  return prisma.birdConsumption.findFirst({ where: { id, farmId } });
}

// Verifies the group is this farm's before linking it — otherwise a caller could
// attach another tenant's group (NF5) and a bogus id would surface as an opaque
// FK 500 instead of a clean validation error.
async function assertGroupBelongsToFarm(tx: TxClient, farmId: string, birdGroupId: string) {
  const group = await tx.birdGroup.findFirst({ where: { id: birdGroupId, farmId } });
  if (!group) throw new ValidationError("Pasirinkta paukščių grupė nerasta");
}

export async function createBirdConsumption(
  farmId: string,
  userId: string,
  input: CreateBirdConsumptionInput,
) {
  return prisma.$transaction(async (tx) => {
    await assertGroupBelongsToFarm(tx, farmId, input.birdGroupId);

    const consumption = await tx.birdConsumption.create({
      data: {
        farmId,
        birdGroupId: input.birdGroupId,
        consumptionDate: new Date(input.consumptionDate),
        quantity: input.quantity,
        note: input.note || null,
      },
    });

    // MEAT_USE, not LOSS: the group loses the same birds either way, but the
    // event type is what keeps this out of every mortality figure.
    await adjustBirdGroupQuantityTx(tx, {
      birdGroupId: input.birdGroupId,
      farmId,
      delta: -input.quantity,
      eventType: "MEAT_USE",
      sourceType: "birdConsumption",
      sourceId: consumption.id,
      note: input.note,
      userId,
    });

    return consumption;
  });
}

// Gives back the birds a record had taken out of its group, as a compensating
// audit event (BirdGroup.quantity has a single writer, so we go through
// adjustBirdGroupQuantityTx rather than editing quantity directly).
async function restoreConsumptionQuantityTx(
  tx: TxClient,
  farmId: string,
  userId: string,
  consumption: { id: string; birdGroupId: string; quantity: number },
) {
  await adjustBirdGroupQuantityTx(tx, {
    birdGroupId: consumption.birdGroupId,
    farmId,
    delta: consumption.quantity,
    eventType: "MANUAL_ADJUSTMENT",
    sourceType: "birdConsumption",
    sourceId: consumption.id,
    note: "Mėsai suvartotų paukščių įrašo korekcija",
    userId,
  });
}

export async function updateBirdConsumption(
  farmId: string,
  id: string,
  userId: string,
  input: CreateBirdConsumptionInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.birdConsumption.findFirst({ where: { id, farmId } });
    if (!existing) throw new ValidationError("Mėsai suvartotų paukščių įrašas nerastas");

    await assertGroupBelongsToFarm(tx, farmId, input.birdGroupId);

    // Reconcile the head-count effect. Same group → apply only the net change,
    // recorded as a correction because that is what editing a saved record is;
    // group changed → give the old group its birds back and take the new count
    // from the new group under this record's own event type.
    if (existing.birdGroupId === input.birdGroupId) {
      const delta = existing.quantity - input.quantity; // >0 restores, <0 removes more
      if (delta !== 0) {
        await adjustBirdGroupQuantityTx(tx, {
          birdGroupId: input.birdGroupId,
          farmId,
          delta,
          eventType: delta > 0 ? "MANUAL_ADJUSTMENT" : "MEAT_USE",
          sourceType: "birdConsumption",
          sourceId: existing.id,
          note: "Mėsai suvartotų paukščių įrašo korekcija",
          userId,
        });
      }
    } else {
      await restoreConsumptionQuantityTx(tx, farmId, userId, existing);
      await adjustBirdGroupQuantityTx(tx, {
        birdGroupId: input.birdGroupId,
        farmId,
        delta: -input.quantity,
        eventType: "MEAT_USE",
        sourceType: "birdConsumption",
        sourceId: existing.id,
        note: input.note,
        userId,
      });
    }

    return tx.birdConsumption.update({
      where: { id },
      data: {
        birdGroupId: input.birdGroupId,
        consumptionDate: new Date(input.consumptionDate),
        quantity: input.quantity,
        note: input.note || null,
      },
    });
  });
}

export async function deleteBirdConsumption(farmId: string, id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.birdConsumption.findFirst({ where: { id, farmId } });
    if (!existing) throw new ValidationError("Mėsai suvartotų paukščių įrašas nerastas");

    await restoreConsumptionQuantityTx(tx, farmId, userId, existing);
    await tx.birdConsumption.delete({ where: { id } });
  });
}

/**
 * Head count used for meat/food in a period. Both range ends are optional so a
 * caller can leave it open on either side, matching getBirdTransactionTotals.
 */
export async function getBirdConsumptionTotal(
  farmId: string,
  range?: { from?: Date; to?: Date },
): Promise<number> {
  const dateFilter = {
    ...(range?.from ? { gte: range.from } : {}),
    ...(range?.to ? { lte: range.to } : {}),
  };

  const agg = await prisma.birdConsumption.aggregate({
    where: {
      farmId,
      ...(Object.keys(dateFilter).length > 0 ? { consumptionDate: dateFilter } : {}),
    },
    _sum: { quantity: true },
  });

  return agg._sum.quantity ?? 0;
}
