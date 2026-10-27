import { ValidationError } from "@/lib/errors";
import { farmAreaLabels } from "@/lib/labels";
import {
  SINGLE_TARGET_MESSAGE,
  countTargets,
  type TargetFields,
} from "@/lib/validation/farm-areas";
import type { FarmArea, Prisma, PrismaClient } from "@/generated/prisma/client";

// Shared rules for the optional target an expense or a loss can point at (a
// bird group, a mother hen or an incubation cycle) and the farm area that
// target belongs to (#179, README § Finance model).

type Db = PrismaClient | Prisma.TransactionClient;

export type Target = {
  birdGroupId: string | null;
  motherHenId: string | null;
  incubationCycleId: string | null;
};

const TARGET_KEYS = ["birdGroupId", "motherHenId", "incubationCycleId"] as const;

/**
 * Normalises the target fields of a request. Without `existing` (create) a
 * missing or empty id means "none". With `existing` (update):
 * - any non-empty id replaces the target as a whole, so moving an expense
 *   from a group to a hen never leaves both set;
 * - otherwise a slot is cleared only when its own key is sent empty. The V1
 *   loss form always sends `birdGroupId: ""` and knows nothing of hens or
 *   cycles, so editing a hen's loss there must not silently drop the hen.
 */
export function targetFromInput(input: TargetFields, existing?: Target): Target {
  const chosen = TARGET_KEYS.some((key) => input[key]);
  if (!existing || chosen) {
    return {
      birdGroupId: input.birdGroupId || null,
      motherHenId: input.motherHenId || null,
      incubationCycleId: input.incubationCycleId || null,
    };
  }
  // Copy only the target slots: `existing` is usually the whole stored row.
  const kept: Target = {
    birdGroupId: existing.birdGroupId,
    motherHenId: existing.motherHenId,
    incubationCycleId: existing.incubationCycleId,
  };
  for (const key of TARGET_KEYS) {
    if (input[key] !== undefined) kept[key] = null;
  }
  return kept;
}

export function sameTarget(a: Target, b: Target): boolean {
  return (
    a.birdGroupId === b.birdGroupId &&
    a.motherHenId === b.motherHenId &&
    a.incubationCycleId === b.incubationCycleId
  );
}

/**
 * The area a target belongs to, or null when there is no target. Each lookup
 * is scoped to `farmId`, so another farm's id is reported as not found
 * (ValidationError → 400), the same as any other cross-tenant reference.
 */
export async function resolveTargetArea(
  db: Db,
  farmId: string,
  target: Target,
): Promise<FarmArea | null> {
  if (countTargets(target) > 1) throw new ValidationError(SINGLE_TARGET_MESSAGE);

  if (target.birdGroupId) {
    const group = await db.birdGroup.findFirst({ where: { id: target.birdGroupId, farmId } });
    if (!group) throw new ValidationError("Pasirinkta paukščių grupė nerasta");
    return group.area;
  }
  if (target.motherHenId) {
    const hen = await db.motherHen.findFirst({ where: { id: target.motherHenId, farmId } });
    if (!hen) throw new ValidationError("Pasirinkta perekšlė nerasta");
    return "HENS";
  }
  if (target.incubationCycleId) {
    const cycle = await db.incubationCycle.findFirst({
      where: { id: target.incubationCycleId, farmId },
    });
    if (!cycle) throw new ValidationError("Pasirinktas perinimo ciklas nerastas");
    return "INC";
  }
  return null;
}

/** Rejects a target that sits outside the expense's area (incl. any target on "Bendra"). */
export function assertTargetInArea(area: FarmArea, targetArea: FarmArea | null): void {
  if (targetArea === null || targetArea === area) return;
  if (area === "SHARED") {
    throw new ValidationError(
      "Bendroms išlaidoms negalima pasirinkti paukščių grupės, perekšlės ar perinimo ciklo",
    );
  }
  throw new ValidationError(
    `Pasirinktas įrašas priklauso sričiai „${farmAreaLabels[targetArea]}“, o išlaidos – sričiai „${farmAreaLabels[area]}“`,
  );
}
