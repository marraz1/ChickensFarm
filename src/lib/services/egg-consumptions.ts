import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/errors";
import type { CreateEggConsumptionInput } from "@/lib/validation/egg-consumptions";

export function listEggConsumptions(farmId: string) {
  return prisma.eggConsumption.findMany({
    where: { farmId },
    orderBy: { consumptionDate: "desc" },
  });
}

export function getEggConsumption(farmId: string, id: string) {
  return prisma.eggConsumption.findFirst({ where: { id, farmId } });
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

export async function updateEggConsumption(
  farmId: string,
  id: string,
  input: CreateEggConsumptionInput
) {
  const existing = await prisma.eggConsumption.findFirst({ where: { id, farmId } });
  if (!existing) throw new ValidationError("Įrašas nerastas");

  return prisma.eggConsumption.update({
    where: { id },
    data: {
      consumptionDate: new Date(input.consumptionDate),
      quantity: input.quantity,
      note: input.note || null,
    },
  });
}

export async function deleteEggConsumption(farmId: string, id: string) {
  const existing = await prisma.eggConsumption.findFirst({ where: { id, farmId } });
  if (!existing) throw new ValidationError("Įrašas nerastas");
  await prisma.eggConsumption.delete({ where: { id } });
}
