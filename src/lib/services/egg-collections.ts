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
