import { prisma } from "@/lib/prisma";
import type { BirdType } from "@/generated/prisma/client";
import { birdTypeOrder } from "@/lib/labels";

export type ActivityItem = {
  id: string;
  type: "EGG_COLLECTION" | "LOSS" | "MOTHER_HEN_LOG";
  summary: string;
  createdAt: Date;
};

export async function getDashboardData(farmId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);

  const [
    totalBirdsAgg,
    birdGroupsForTypes,
    activeIncubationCount,
    eggsThisMonthAgg,
    eggsThisYearAgg,
    eggsCollectedTotalAgg,
    eggsSoldTotalAgg,
    eggsConsumedTotalAgg,
    incomeThisMonthAgg,
    expensesThisMonthAgg,
    lossesLast30dAgg,
    recentCollections,
    recentLosses,
    recentHenLogs,
  ] = await Promise.all([
    prisma.birdGroup.aggregate({ where: { farmId }, _sum: { quantity: true } }),
    // Current live headcount per species (birdType lives on the breed, so we
    // pull each group's breed type and sum in code). Lets the dashboard show a
    // by-species summary that always reflects what the farm actually holds.
    prisma.birdGroup.findMany({
      where: { farmId },
      select: { quantity: true, breed: { select: { birdType: true } } },
    }),
    prisma.incubationCycle.count({ where: { farmId, hatchDate: null } }),
    prisma.eggCollection.aggregate({
      where: { farmId, collectionDate: { gte: monthStart } },
      _sum: { quantity: true },
    }),
    prisma.eggCollection.aggregate({
      where: { farmId, collectionDate: { gte: yearStart } },
      _sum: { quantity: true },
    }),
    // Remaining stock = all eggs ever collected minus those sold and consumed (eaten).
    prisma.eggCollection.aggregate({ where: { farmId }, _sum: { quantity: true } }),
    prisma.eggSale.aggregate({ where: { farmId }, _sum: { quantity: true } }),
    prisma.eggConsumption.aggregate({ where: { farmId }, _sum: { quantity: true } }),
    prisma.eggSale.aggregate({
      where: { farmId, saleDate: { gte: monthStart } },
      _sum: { totalAmount: true },
    }),
    prisma.expense.aggregate({
      where: { farmId, expenseDate: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.loss.aggregate({
      where: { farmId, lossDate: { gte: thirtyDaysAgo } },
      _sum: { quantity: true },
    }),
    prisma.eggCollection.findMany({
      where: { farmId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.loss.findMany({
      where: { farmId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { birdGroup: { include: { breed: true } } },
    }),
    prisma.motherHenLog.findMany({
      where: { motherHen: { farmId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { motherHen: { select: { name: true } } },
    }),
  ]);

  const eggsRemaining =
    (eggsCollectedTotalAgg._sum.quantity ?? 0) -
    (eggsSoldTotalAgg._sum.quantity ?? 0) -
    (eggsConsumedTotalAgg._sum.quantity ?? 0);

  const activity: ActivityItem[] = [
    ...recentCollections.map((c) => ({
      id: c.id,
      type: "EGG_COLLECTION" as const,
      summary: `Surinkta ${c.quantity} kiaušiniai`,
      createdAt: c.createdAt,
    })),
    ...recentLosses.map((l) => ({
      id: l.id,
      type: "LOSS" as const,
      summary: `Nuostolis: ${l.reasonType === "PREDATOR" ? "plėšrūnas" : l.reasonType === "DISEASE" ? "liga" : "kita"}, ${l.quantity} vnt.`,
      createdAt: l.createdAt,
    })),
    ...recentHenLogs.map((log) => ({
      id: log.id,
      type: "MOTHER_HEN_LOG" as const,
      summary: `Perekšlė ${log.motherHen.name} – naujas įrašas`,
      createdAt: log.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10);

  const quantityByType = new Map<BirdType, number>();
  for (const group of birdGroupsForTypes) {
    const type = group.breed.birdType;
    quantityByType.set(type, (quantityByType.get(type) ?? 0) + group.quantity);
  }
  const birdsByType = birdTypeOrder
    .map((birdType) => ({ birdType, quantity: quantityByType.get(birdType) ?? 0 }))
    .filter((entry) => entry.quantity > 0);

  return {
    totalBirds: totalBirdsAgg._sum.quantity ?? 0,
    birdsByType,
    activeIncubationCount,
    eggsThisMonth: eggsThisMonthAgg._sum.quantity ?? 0,
    eggsThisYear: eggsThisYearAgg._sum.quantity ?? 0,
    eggsRemaining,
    incomeThisMonth: Number(incomeThisMonthAgg._sum.totalAmount ?? 0),
    expensesThisMonth: Number(expensesThisMonthAgg._sum.amount ?? 0),
    lossesLast30d: lossesLast30dAgg._sum.quantity ?? 0,
    activity,
  };
}
