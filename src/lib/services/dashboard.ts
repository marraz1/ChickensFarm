import { prisma } from "@/lib/prisma";

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
    layersAgg,
    roostersAgg,
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
    prisma.birdGroup.aggregate({ where: { farmId, category: "LAYER" }, _sum: { quantity: true } }),
    prisma.birdGroup.aggregate({ where: { farmId, category: "ROOSTER" }, _sum: { quantity: true } }),
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

  return {
    totalBirds: totalBirdsAgg._sum.quantity ?? 0,
    layerBirds: layersAgg._sum.quantity ?? 0,
    roosterBirds: roostersAgg._sum.quantity ?? 0,
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
