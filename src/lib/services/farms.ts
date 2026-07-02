import { prisma } from "@/lib/prisma";
import type { CreateFarmInput, UpdateFarmInput } from "@/lib/validation/farms";

export function listFarmsForUser(userId: string) {
  return prisma.farm.findMany({
    where: { deletedAt: null, farmUsers: { some: { userId } } },
    orderBy: { createdAt: "asc" },
  });
}

export function createFarm(userId: string, input: CreateFarmInput) {
  return prisma.$transaction(async (tx) => {
    const farm = await tx.farm.create({
      data: {
        ownerId: userId,
        name: input.name,
        location: input.location || null,
      },
    });
    await tx.farmUser.create({
      data: { farmId: farm.id, userId, role: "OWNER" },
    });
    return farm;
  });
}

export function updateFarm(farmId: string, input: UpdateFarmInput) {
  return prisma.farm.update({
    where: { id: farmId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.location !== undefined ? { location: input.location || null } : {}),
    },
  });
}

export function softDeleteFarm(farmId: string) {
  return prisma.farm.update({ where: { id: farmId }, data: { deletedAt: new Date() } });
}
