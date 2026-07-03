import { prisma } from "@/lib/prisma";
import type { CreateEggSaleInput } from "@/lib/validation/egg-sales";

export function listEggSales(farmId: string) {
  return prisma.eggSale.findMany({
    where: { farmId },
    orderBy: { saleDate: "desc" },
  });
}

export function createEggSale(farmId: string, input: CreateEggSaleInput) {
  const totalAmount = input.totalAmount ?? input.quantity * input.unitPrice;
  return prisma.eggSale.create({
    data: {
      farmId,
      saleDate: new Date(input.saleDate),
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      totalAmount,
      buyer: input.buyer || null,
    },
  });
}

export async function getEggStockReport(farmId: string, range?: { from: Date; to: Date }) {
  const periodFilter = range ? { gte: range.from, lte: range.to } : undefined;

  const [
    collectedAgg,
    soldAgg,
    consumedAgg,
    allTimeCollectedAgg,
    allTimeSoldAgg,
    allTimeConsumedAgg,
  ] = await Promise.all([
    prisma.eggCollection.aggregate({
      where: { farmId, ...(periodFilter ? { collectionDate: periodFilter } : {}) },
      _sum: { quantity: true },
    }),
    prisma.eggSale.aggregate({
      where: { farmId, ...(periodFilter ? { saleDate: periodFilter } : {}) },
      _sum: { quantity: true, totalAmount: true },
    }),
    prisma.eggConsumption.aggregate({
      where: { farmId, ...(periodFilter ? { consumptionDate: periodFilter } : {}) },
      _sum: { quantity: true },
    }),
    prisma.eggCollection.aggregate({ where: { farmId }, _sum: { quantity: true } }),
    prisma.eggSale.aggregate({ where: { farmId }, _sum: { quantity: true } }),
    prisma.eggConsumption.aggregate({ where: { farmId }, _sum: { quantity: true } }),
  ]);

  return {
    collectedInPeriod: collectedAgg._sum.quantity ?? 0,
    soldInPeriod: soldAgg._sum.quantity ?? 0,
    consumedInPeriod: consumedAgg._sum.quantity ?? 0,
    revenueInPeriod: Number(soldAgg._sum.totalAmount ?? 0),
    // Stock on hand = collected − sold − consumed (eaten).
    remainingStock:
      (allTimeCollectedAgg._sum.quantity ?? 0) -
      (allTimeSoldAgg._sum.quantity ?? 0) -
      (allTimeConsumedAgg._sum.quantity ?? 0),
  };
}
