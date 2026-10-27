import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/errors";
import { getLocalNow } from "@/lib/notification-schedule";
import type { CreateMotherHenInput, CreateMotherHenLogInput } from "@/lib/validation/mother-hens";

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

  const diedAt = parseDiedAt(input.diedAt);

  return prisma.motherHen.create({
    data: {
      farmId,
      diedAt,
      name: input.name,
      birdGroupId,
      photoUrl: input.photoUrl || null,
      description: input.description || null,
    },
  });
}

// The farm's calendar day, not UTC's: just after midnight in Vilnius, UTC is
// still on yesterday and would reject a death recorded "today".
const FARM_TIME_ZONE = "Europe/Vilnius";

// undefined → leave unchanged; "" or null → alive; "YYYY-MM-DD" → died that day.
function parseDiedAt(diedAt: string | null | undefined): Date | null | undefined {
  if (diedAt === undefined) return undefined;
  if (!diedAt) return null;
  if (diedAt > getLocalNow(new Date(), FARM_TIME_ZONE).date) {
    throw new ValidationError("Kritimo data negali būti ateityje");
  }
  return new Date(diedAt);
}

export async function updateMotherHen(
  farmId: string,
  motherHenId: string,
  input: CreateMotherHenInput,
) {
  const hen = await prisma.motherHen.findFirst({ where: { id: motherHenId, farmId } });
  if (!hen) throw new ValidationError("Perekšlė nerasta");

  const diedAt = parseDiedAt(input.diedAt);
  const birdGroupId = input.birdGroupId || null;
  if (birdGroupId) {
    const group = await prisma.birdGroup.findFirst({ where: { id: birdGroupId, farmId } });
    if (!group) throw new ValidationError("Pasirinkta paukščių grupė nerasta");
  }

  return prisma.motherHen.update({
    where: { id: motherHenId },
    data: {
      name: input.name,
      birdGroupId,
      photoUrl: input.photoUrl || null,
      description: input.description || null,
      diedAt,
    },
  });
}

export async function deleteMotherHen(farmId: string, motherHenId: string) {
  const hen = await prisma.motherHen.findFirst({ where: { id: motherHenId, farmId } });
  if (!hen) throw new ValidationError("Perekšlė nerasta");

  // Expenses and losses would merely have their link nulled, silently
  // detaching the hen's cost and loss history — blocked, as for bird groups.
  const [expenses, losses] = await Promise.all([
    prisma.expense.count({ where: { motherHenId } }),
    prisma.loss.count({ where: { motherHenId } }),
  ]);
  if (expenses + losses > 0) {
    throw new ValidationError(
      "Perekšlė susieta su išlaidomis ar nuostoliais, todėl jos ištrinti negalima",
    );
  }

  // Diary entries (MotherHenLog) cascade away with the hen.
  await prisma.motherHen.delete({ where: { id: motherHenId } });
}

export async function addMotherHenLog(
  farmId: string,
  motherHenId: string,
  input: CreateMotherHenLogInput,
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
