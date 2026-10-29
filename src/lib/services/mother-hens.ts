import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/errors";
import { getLocalNow } from "@/lib/notification-schedule";
import type { CreateMotherHenInput, CreateMotherHenLogInput } from "@/lib/validation/mother-hens";
import type { Prisma } from "@/generated/prisma/client";

type DbClient = Prisma.TransactionClient | typeof prisma;

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

/**
 * The broods hens are sitting on (#188): cycles with a hen and no hatch date
 * yet — one hen's, or every hen's. The single definition of "sitting" behind
 * the Perekšlės overview, the cycle form's hen list and the save check.
 */
export function openBroodsWhere(farmId: string, motherHenId?: string) {
  return {
    farmId,
    hatchDate: null,
    motherHenId: motherHenId ?? { not: null as null },
  } satisfies Prisma.IncubationCycleWhereInput;
}

/**
 * Refuses setting a hen on eggs unless she is this farm's (tenant isolation,
 * NF5), alive and not already sitting. Takes the transaction client, so the
 * check and the new cycle commit together (createIncubationCycle).
 */
export async function assertHenCanSit(db: DbClient, farmId: string, motherHenId: string) {
  const [hen, sitting] = await Promise.all([
    db.motherHen.findFirst({ where: { id: motherHenId, farmId } }),
    db.incubationCycle.findFirst({ where: openBroodsWhere(farmId, motherHenId) }),
  ]);
  if (!hen) throw new ValidationError("Pasirinkta perekšlė nerasta");
  if (hen.diedAt) throw new ValidationError("Nugaišusi perekšlė negali perėti");
  if (sitting) throw new ValidationError("Ši perekšlė jau peri");
}

/** Whether one hen can be set on eggs now: alive and not sitting. */
export async function canHenSit(farmId: string, hen: { id: string; diedAt: Date | null }) {
  if (hen.diedAt) return false;
  return !(await prisma.incubationCycle.findFirst({ where: openBroodsWhere(farmId, hen.id) }));
}

/**
 * Hens that can be set on eggs (#188): alive, and not already sitting on a
 * cycle that has not hatched. The cycle form offers these; assertHenCanSit
 * enforces the same rule on save.
 */
export async function listHensFreeToSit(farmId: string) {
  const [hens, active] = await Promise.all([
    prisma.motherHen.findMany({
      where: { farmId, diedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.incubationCycle.findMany({
      where: openBroodsWhere(farmId),
      select: { motherHenId: true },
    }),
  ]);
  const sitting = new Set(active.map((c) => c.motherHenId));
  // Sorted here too: the test double ignores orderBy.
  return hens.filter((h) => !sitting.has(h.id)).sort((a, b) => a.name.localeCompare(b.name, "lt"));
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

/** Refuses a death date after the farm's today ("YYYY-MM-DD"). */
export function assertDiedAtNotFuture(diedAt: string) {
  if (diedAt > getLocalNow(new Date(), FARM_TIME_ZONE).date) {
    throw new ValidationError("Kritimo data negali būti ateityje");
  }
}

// undefined → leave unchanged; "" or null → alive; "YYYY-MM-DD" → died that day.
function parseDiedAt(diedAt: string | null | undefined): Date | null | undefined {
  if (diedAt === undefined) return undefined;
  if (!diedAt) return null;
  assertDiedAtNotFuture(diedAt);
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
