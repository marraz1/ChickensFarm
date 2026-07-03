import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/errors";
import type {
  CreateMotherHenInput,
  CreateMotherHenLogInput,
} from "@/lib/validation/mother-hens";

export function listMotherHens(farmId: string) {
  return prisma.motherHen.findMany({
    where: { farmId },
    include: {
      birdGroup: { include: { breed: true } },
      _count: { select: { logs: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function getMotherHenWithLogs(farmId: string, motherHenId: string) {
  return prisma.motherHen.findFirst({
    where: { id: motherHenId, farmId },
    include: {
      birdGroup: { include: { breed: true } },
      logs: { orderBy: { entryDate: "desc" } },
    },
  });
}

export async function createMotherHen(farmId: string, input: CreateMotherHenInput) {
  const birdGroupId = input.birdGroupId || null;

  // A linked group must belong to this farm (tenant isolation, NF5).
  if (birdGroupId) {
    const group = await prisma.birdGroup.findFirst({ where: { id: birdGroupId, farmId } });
    if (!group) throw new ValidationError("Pasirinkta paukščių grupė nerasta");
  }

  return prisma.motherHen.create({
    data: {
      farmId,
      name: input.name,
      birdGroupId,
      photoUrl: input.photoUrl || null,
      description: input.description || null,
    },
  });
}

export async function addMotherHenLog(
  farmId: string,
  motherHenId: string,
  input: CreateMotherHenLogInput
) {
  // Ensure the hen belongs to this farm before appending to its diary.
  const hen = await prisma.motherHen.findFirst({ where: { id: motherHenId, farmId } });
  if (!hen) throw new ValidationError("Perekšlė nerasta");

  return prisma.motherHenLog.create({
    data: {
      motherHenId,
      entryDate: new Date(input.entryDate),
      note: input.note || null,
      photoUrl: input.photoUrl || null,
    },
  });
}
