import { prisma } from "@/lib/prisma";
import type { Prisma, BirdGroupEventType } from "@/generated/prisma/client";
import type { CreateBirdGroupInput, UpdateBirdGroupInput } from "@/lib/validation/bird-groups";
import { ValidationError, ConcurrentModificationError } from "@/lib/errors";

type TxClient = Prisma.TransactionClient;

export class NegativeQuantityError extends Error {
  constructor() {
    super("Rezultatas būtų neigiamas kiekis");
    this.name = "NegativeQuantityError";
  }
}

// Raised when a delete is blocked because the group is still referenced by
// historical records (losses, egg collections, mother hens, incubation cycles).
export class GroupHasReferencesError extends ValidationError {
  constructor() {
    super("Grupė susieta su įrašais (nuostoliais, kiaušiniais, inkubacija ar perekšlėmis), todėl jos ištrinti negalima");
    this.name = "GroupHasReferencesError";
  }
}

// The single writer of BirdGroup.quantity. Every change is paired with a BirdGroupEvent
// row so the group's full history (F4.3) can always be reconstructed.
export async function adjustBirdGroupQuantityTx(
  tx: TxClient,
  params: {
    birdGroupId: string;
    farmId: string;
    delta: number;
    eventType: BirdGroupEventType;
    sourceType?: string;
    sourceId?: string;
    note?: string;
    userId: string;
  }
) {
  const group = await tx.birdGroup.findFirst({
    where: { id: params.birdGroupId, farmId: params.farmId },
  });
  if (!group) throw new ValidationError("Paukščių grupė nerasta");

  const quantityAfter = group.quantity + params.delta;
  if (quantityAfter < 0) throw new NegativeQuantityError();

  // Optimistic-concurrency guard: only apply the write if the quantity is still
  // exactly what we read. If a concurrent transaction changed it in between, the
  // guard matches 0 rows and we abort rather than clobbering the other update or
  // recording an audit event with a stale quantityBefore.
  const updated = await tx.birdGroup.updateMany({
    where: { id: group.id, quantity: group.quantity },
    data: { quantity: quantityAfter },
  });
  if (updated.count === 0) throw new ConcurrentModificationError();

  await tx.birdGroupEvent.create({
    data: {
      birdGroupId: group.id,
      farmId: params.farmId,
      eventType: params.eventType,
      quantityDelta: params.delta,
      quantityBefore: group.quantity,
      quantityAfter,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      note: params.note || null,
      createdById: params.userId,
    },
  });

  return quantityAfter;
}

export function listBirdGroups(farmId: string) {
  return prisma.birdGroup.findMany({
    where: { farmId },
    include: { breed: true },
    orderBy: { createdAt: "desc" },
  });
}

export function getBirdGroupWithEvents(farmId: string, birdGroupId: string) {
  return prisma.birdGroup.findFirst({
    where: { id: birdGroupId, farmId },
    include: {
      breed: true,
      events: { orderBy: { createdAt: "desc" }, include: { createdBy: true } },
    },
  });
}

export async function createBirdGroup(farmId: string, userId: string, input: CreateBirdGroupInput) {
  return prisma.$transaction(async (tx) => {
    // Verify the referenced breed belongs to this farm before linking it —
    // otherwise a caller could attach another tenant's breed (NF5) and a bogus
    // id would surface as an opaque FK 500 instead of a clean validation error.
    const breed = await tx.breed.findFirst({ where: { id: input.breedId, farmId } });
    if (!breed) throw new ValidationError("Pasirinkta veislė nerasta");

    const group = await tx.birdGroup.create({
      data: {
        farmId,
        breedId: input.breedId,
        name: input.name?.trim() || null,
        sex: input.sex,
        category: input.category,
        quantity: input.quantity,
        birthOrAcquiredDate: new Date(input.birthOrAcquiredDate),
        notes: input.notes || null,
      },
    });

    await tx.birdGroupEvent.create({
      data: {
        birdGroupId: group.id,
        farmId,
        eventType: "INITIAL",
        quantityDelta: input.quantity,
        quantityBefore: 0,
        quantityAfter: input.quantity,
        note: "Grupė sukurta",
        createdById: userId,
      },
    });

    return group;
  });
}

// Full edit of a group's details. All non-quantity fields are updated in place;
// a quantity change is recorded as a MANUAL_ADJUSTMENT audit event so the
// group's history stays complete.
export async function updateBirdGroup(
  farmId: string,
  birdGroupId: string,
  userId: string,
  input: UpdateBirdGroupInput
) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.birdGroup.findFirst({ where: { id: birdGroupId, farmId } });
    if (!group) throw new ValidationError("Paukščių grupė nerasta");

    // Guard the breed reference the same way create does — never let a caller
    // point a group at another tenant's breed.
    if (input.breedId !== group.breedId) {
      const breed = await tx.breed.findFirst({ where: { id: input.breedId, farmId } });
      if (!breed) throw new ValidationError("Pasirinkta veislė nerasta");
    }

    await tx.birdGroup.update({
      where: { id: birdGroupId },
      data: {
        breedId: input.breedId,
        name: input.name?.trim() || null,
        sex: input.sex,
        category: input.category,
        birthOrAcquiredDate: new Date(input.birthOrAcquiredDate),
        notes: input.notes || null,
      },
    });

    const delta = input.quantity - group.quantity;
    if (delta !== 0) {
      await adjustBirdGroupQuantityTx(tx, {
        birdGroupId,
        farmId,
        delta,
        eventType: "MANUAL_ADJUSTMENT",
        note: input.adjustmentNote,
        userId,
      });
    }

    return tx.birdGroup.findFirstOrThrow({ where: { id: birdGroupId } });
  });
}

// Deletes a group only when nothing else references it. History (BirdGroupEvent)
// cascades away with the group; losses/eggs/incubation/mother-hens would merely
// have their link nulled, silently detaching real records — so we block instead.
export async function deleteBirdGroup(farmId: string, birdGroupId: string) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.birdGroup.findFirst({ where: { id: birdGroupId, farmId } });
    if (!group) throw new ValidationError("Paukščių grupė nerasta");

    const [motherHens, losses, eggCollections, sourceCycles, resultCycles] = await Promise.all([
      tx.motherHen.count({ where: { birdGroupId } }),
      tx.loss.count({ where: { birdGroupId } }),
      tx.eggCollection.count({ where: { birdGroupId } }),
      tx.incubationCycle.count({ where: { eggSourceGroupId: birdGroupId } }),
      tx.incubationCycle.count({ where: { resultingGroupId: birdGroupId } }),
    ]);

    if (motherHens + losses + eggCollections + sourceCycles + resultCycles > 0) {
      throw new GroupHasReferencesError();
    }

    await tx.birdGroup.delete({ where: { id: birdGroupId } });
  });
}
