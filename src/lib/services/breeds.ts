import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/errors";
import type { CreateBreedInput, UpdateBreedInput } from "@/lib/validation/breeds";

export function listBreeds(farmId: string) {
  return prisma.breed.findMany({
    where: { farmId },
    orderBy: [{ birdType: "asc" }, { name: "asc" }],
  });
}

export function getBreed(farmId: string, breedId: string) {
  return prisma.breed.findFirst({ where: { id: breedId, farmId } });
}

export function createBreed(farmId: string, input: CreateBreedInput) {
  return prisma.breed.create({
    data: {
      farmId,
      name: input.name,
      birdType: input.birdType,
      description: input.description || null,
    },
  });
}

export function updateBreed(farmId: string, breedId: string, input: UpdateBreedInput) {
  return prisma.breed.updateMany({
    where: { id: breedId, farmId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.birdType !== undefined ? { birdType: input.birdType } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
    },
  });
}

export async function deleteBreed(farmId: string, breedId: string) {
  const breed = await prisma.breed.findFirst({ where: { id: breedId, farmId } });
  if (!breed) throw new ValidationError("Veislė nerasta");

  // Bird groups reference the breed with onDelete: Restrict — deleting a breed
  // still used by a group would raise an opaque FK 500, so block it with a clear
  // message instead.
  const groups = await prisma.birdGroup.count({ where: { breedId, farmId } });
  if (groups > 0) {
    throw new ValidationError("Veislė priskirta paukščių grupei, todėl jos ištrinti negalima");
  }

  await prisma.breed.delete({ where: { id: breedId } });
}
