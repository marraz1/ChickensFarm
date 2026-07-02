import { prisma } from "@/lib/prisma";
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

export function deleteBreed(farmId: string, breedId: string) {
  return prisma.breed.deleteMany({ where: { id: breedId, farmId } });
}
