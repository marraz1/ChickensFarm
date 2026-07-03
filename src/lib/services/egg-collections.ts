import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/errors";
import type { CreateEggCollectionInput } from "@/lib/validation/egg-collections";

export function listEggCollections(farmId: string) {
  return prisma.eggCollection.findMany({
    where: { farmId },
    include: { birdGroup: { include: { breed: true } } },
    orderBy: { collectionDate: "desc" },
  });
}

export function getEggCollection(farmId: string, id: string) {
  return prisma.eggCollection.findFirst({ where: { id, farmId } });
}

export async function createEggCollection(farmId: string, input: CreateEggCollectionInput) {
  const birdGroupId = input.birdGroupId || null;

  // If a group is linked, it must belong to this farm (tenant isolation, NF5).
  if (birdGroupId) {
    const group = await prisma.birdGroup.findFirst({ where: { id: birdGroupId, farmId } });
    if (!group) throw new ValidationError("Pasirinkta paukščių grupė nerasta");
  }

  return prisma.eggCollection.create({
    data: {
      farmId,
      collectionDate: new Date(input.collectionDate),
      quantity: input.quantity,
      birdGroupId,
      quality: input.quality,
    },
  });
}

export async function updateEggCollection(
  farmId: string,
  id: string,
  input: CreateEggCollectionInput
) {
  const existing = await prisma.eggCollection.findFirst({ where: { id, farmId } });
  if (!existing) throw new ValidationError("Įrašas nerastas");

  const birdGroupId = input.birdGroupId || null;
  if (birdGroupId) {
    const group = await prisma.birdGroup.findFirst({ where: { id: birdGroupId, farmId } });
    if (!group) throw new ValidationError("Pasirinkta paukščių grupė nerasta");
  }

  return prisma.eggCollection.update({
    where: { id },
    data: {
      collectionDate: new Date(input.collectionDate),
      quantity: input.quantity,
      birdGroupId,
      quality: input.quality,
    },
  });
}

export async function deleteEggCollection(farmId: string, id: string) {
  const existing = await prisma.eggCollection.findFirst({ where: { id, farmId } });
  if (!existing) throw new ValidationError("Įrašas nerastas");
  await prisma.eggCollection.delete({ where: { id } });
}
