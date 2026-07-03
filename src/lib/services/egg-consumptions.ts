import { prisma } from "@/lib/prisma";
import type { CreateEggConsumptionInput } from "@/lib/validation/egg-consumptions";

export function listEggConsumptions(farmId: string) {
  return prisma.eggConsumption.findMany({
    where: { farmId },
    orderBy: { consumptionDate: "desc" },
  });
}

export function createEggConsumption(farmId: string, input: CreateEggConsumptionInput) {
  return prisma.eggConsumption.create({
    data: {
      farmId,
      consumptionDate: new Date(input.consumptionDate),
      quantity: input.quantity,
      note: input.note || null,
    },
  });
}
