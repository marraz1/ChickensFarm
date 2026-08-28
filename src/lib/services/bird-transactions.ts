import { prisma } from "@/lib/prisma";
import { adjustBirdGroupQuantityTx } from "@/lib/services/bird-groups";
import { ValidationError } from "@/lib/errors";
import type { Prisma, BirdTransactionType } from "@/generated/prisma/client";
import type { CreateBirdTransactionInput } from "@/lib/validation/bird-transactions";

type TxClient = Prisma.TransactionClient;

/**
 * How a transaction moves the linked group's head count: a purchase brings
 * birds in, a sale takes them out. The single place the sign is decided, so the
 * create/update/delete paths can never disagree about it.
 */
export function signedQuantityDelta(type: BirdTransactionType, quantity: number): number {
  return type === "PURCHASE" ? quantity : -quantity;
}

/** quantity × unitPrice unless the user pinned a hand-agreed total. */
function resolveTotal(input: CreateBirdTransactionInput): number {
  return input.totalAmount ?? input.quantity * input.unitPrice;
}

export function listBirdTransactions(farmId: string, type?: BirdTransactionType) {
  return prisma.birdTransaction.findMany({
    where: { farmId, ...(type ? { type } : {}) },
    include: { birdGroup: { include: { breed: true } } },
    orderBy: { transactionDate: "desc" },
  });
}

export function getBirdTransaction(farmId: string, id: string) {
  return prisma.birdTransaction.findFirst({ where: { id, farmId } });
}

// Verifies the group is this farm's before linking it — otherwise a caller could
// attach another tenant's group (NF5) and a bogus id would surface as an opaque
// FK 500 instead of a clean validation error.
async function assertGroupBelongsToFarm(tx: TxClient, farmId: string, birdGroupId: string) {
  const group = await tx.birdGroup.findFirst({ where: { id: birdGroupId, farmId } });
  if (!group) throw new ValidationError("Pasirinkta paukščių grupė nerasta");
}

export async function createBirdTransaction(
  farmId: string,
  userId: string,
  input: CreateBirdTransactionInput,
) {
  return prisma.$transaction(async (tx) => {
    const birdGroupId = input.birdGroupId || null;
    if (birdGroupId) await assertGroupBelongsToFarm(tx, farmId, birdGroupId);

    const transaction = await tx.birdTransaction.create({
      data: {
        farmId,
        birdGroupId,
        type: input.type,
        transactionDate: new Date(input.transactionDate),
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        totalAmount: resolveTotal(input),
        counterparty: input.counterparty || null,
        note: input.note || null,
      },
    });

    if (birdGroupId) {
      await adjustBirdGroupQuantityTx(tx, {
        birdGroupId,
        farmId,
        delta: signedQuantityDelta(input.type, input.quantity),
        eventType: input.type,
        sourceType: "birdTransaction",
        sourceId: transaction.id,
        note: input.note,
        userId,
      });
    }

    return transaction;
  });
}

// Undoes a transaction's effect on the group it was linked to, as a compensating
// audit event (BirdGroup.quantity has a single writer, so we go through
// adjustBirdGroupQuantityTx rather than editing quantity directly).
async function revertTransactionQuantityTx(
  tx: TxClient,
  farmId: string,
  userId: string,
  transaction: {
    id: string;
    birdGroupId: string | null;
    type: BirdTransactionType;
    quantity: number;
  },
) {
  if (!transaction.birdGroupId) return;
  await adjustBirdGroupQuantityTx(tx, {
    birdGroupId: transaction.birdGroupId,
    farmId,
    delta: -signedQuantityDelta(transaction.type, transaction.quantity),
    eventType: "MANUAL_ADJUSTMENT",
    sourceType: "birdTransaction",
    sourceId: transaction.id,
    note: "Paukščių sandorio korekcija",
    userId,
  });
}

export async function updateBirdTransaction(
  farmId: string,
  id: string,
  userId: string,
  input: CreateBirdTransactionInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.birdTransaction.findFirst({ where: { id, farmId } });
    if (!existing) throw new ValidationError("Sandorio įrašas nerastas");

    const newGroupId = input.birdGroupId || null;
    if (newGroupId) await assertGroupBelongsToFarm(tx, farmId, newGroupId);

    // Reconcile the head-count effect. Same group → apply only the net change,
    // recorded as a correction because that is what editing a saved record is;
    // group changed → give the old group its birds back and move the new count
    // against the new group under the transaction's own event type.
    if (existing.birdGroupId === newGroupId) {
      const delta =
        signedQuantityDelta(input.type, input.quantity) -
        signedQuantityDelta(existing.type, existing.quantity);
      if (newGroupId && delta !== 0) {
        await adjustBirdGroupQuantityTx(tx, {
          birdGroupId: newGroupId,
          farmId,
          delta,
          eventType: "MANUAL_ADJUSTMENT",
          sourceType: "birdTransaction",
          sourceId: existing.id,
          note: "Paukščių sandorio korekcija",
          userId,
        });
      }
    } else {
      await revertTransactionQuantityTx(tx, farmId, userId, existing);
      if (newGroupId) {
        await adjustBirdGroupQuantityTx(tx, {
          birdGroupId: newGroupId,
          farmId,
          delta: signedQuantityDelta(input.type, input.quantity),
          eventType: input.type,
          sourceType: "birdTransaction",
          sourceId: existing.id,
          note: input.note,
          userId,
        });
      }
    }

    return tx.birdTransaction.update({
      where: { id },
      data: {
        birdGroupId: newGroupId,
        type: input.type,
        transactionDate: new Date(input.transactionDate),
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        totalAmount: resolveTotal(input),
        counterparty: input.counterparty || null,
        note: input.note || null,
      },
    });
  });
}

export async function deleteBirdTransaction(farmId: string, id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.birdTransaction.findFirst({ where: { id, farmId } });
    if (!existing) throw new ValidationError("Sandorio įrašas nerastas");

    await revertTransactionQuantityTx(tx, farmId, userId, existing);
    await tx.birdTransaction.delete({ where: { id } });
  });
}

export type BirdTransactionTotals = {
  /** Money in from selling birds. */
  salesAmount: number;
  birdsSold: number;
  /** Money out on buying birds. */
  purchaseAmount: number;
  birdsBought: number;
};

/**
 * Period totals per direction, used by the finance reports and the dashboard.
 * Both range ends are optional so a caller can leave it open on either side —
 * the dashboard's "this month so far" passes only `from`, matching how it
 * already aggregates egg sales and expenses.
 */
export async function getBirdTransactionTotals(
  farmId: string,
  range?: { from?: Date; to?: Date },
): Promise<BirdTransactionTotals> {
  const dateFilter = {
    ...(range?.from ? { gte: range.from } : {}),
    ...(range?.to ? { lte: range.to } : {}),
  };

  const grouped = await prisma.birdTransaction.groupBy({
    by: ["type"],
    where: {
      farmId,
      ...(Object.keys(dateFilter).length > 0 ? { transactionDate: dateFilter } : {}),
    },
    _sum: { totalAmount: true, quantity: true },
  });

  const totals: BirdTransactionTotals = {
    salesAmount: 0,
    birdsSold: 0,
    purchaseAmount: 0,
    birdsBought: 0,
  };
  for (const row of grouped) {
    const amount = Number(row._sum.totalAmount ?? 0);
    const quantity = row._sum.quantity ?? 0;
    if (row.type === "SALE") {
      totals.salesAmount = amount;
      totals.birdsSold = quantity;
    } else {
      totals.purchaseAmount = amount;
      totals.birdsBought = quantity;
    }
  }
  return totals;
}
