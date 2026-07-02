import { prisma } from "@/lib/prisma";
import { adjustBirdGroupQuantityTx } from "@/lib/services/bird-groups";
import type { CreateLossInput } from "@/lib/validation/losses";
import type { LossReasonType } from "@/generated/prisma/client";

export function listLosses(farmId: string) {
  return prisma.loss.findMany({
    where: { farmId },
    include: { birdGroup: { include: { breed: true } } },
    orderBy: { lossDate: "desc" },
  });
}

export async function createLoss(farmId: string, userId: string, input: CreateLossInput) {
  return prisma.$transaction(async (tx) => {
    const loss = await tx.loss.create({
      data: {
        farmId,
        lossDate: new Date(input.lossDate),
        quantity: input.quantity,
        reasonType: input.reasonType,
        birdGroupId: input.birdGroupId || null,
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
