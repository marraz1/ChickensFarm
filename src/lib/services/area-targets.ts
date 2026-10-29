import { prisma } from "@/lib/prisma";
import { birdGroupOptions } from "@/lib/bird-group-options";
import { birdGroupLabel, cycleLabel } from "@/lib/labels";
import type { AreaSlug } from "@/lib/v2-navigation";

export type TargetOption = { id: string; label: string };

/**
 * What a new expense (#192) or loss (#195) in an area can point at: only the
 * active farm's current targets in that area, as select options.
 *
 * "Current" means it can still incur costs or losses: a group with birds in
 * it, a living mother hen, an incubation cycle whose chick tracking is not
 * finished — and, for a loss, one that has hatched chicks to lose. The server
 * accepts any target of the farm and area (#179) — this only keeps defunct ones
 * out of the list. Lean selects: just what the labels need.
 */
export async function listAreaTargetOptions(
  farmId: string,
  area: AreaSlug,
  purpose: "expense" | "loss",
): Promise<TargetOption[]> {
  switch (area) {
    case "eggs":
    case "meat":
      return birdGroupOptions(
        await prisma.birdGroup.findMany({
          where: { farmId, area: area === "eggs" ? "EGGS" : "MEAT", quantity: { gt: 0 } },
          select: { id: true, name: true, quantity: true, breed: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        }),
      );
    case "hens":
      return (
        await prisma.motherHen.findMany({
          where: { farmId, diedAt: null },
          select: { id: true, name: true },
          orderBy: { createdAt: "desc" },
        })
      ).map((hen) => ({ id: hen.id, label: hen.name }));
    case "incubation":
      return (
        await prisma.incubationCycle.findMany({
          where: {
            farmId,
            growthCompletedAt: null,
            ...(purpose === "loss" ? { hatchedCount: { not: null } } : {}),
          },
          select: { id: true, name: true, startDate: true },
          orderBy: { startDate: "desc" },
        })
      ).map((cycle) => ({ id: cycle.id, label: cycleLabel(cycle) }));
  }
}

/**
 * The name of what a stored expense points at — a group, a mother hen or an
 * incubation cycle — or null when it has none. The general edit form warns
 * with it before a move to another area drops the link (#193). Looked up by
 * `{id, farmId}`, so another farm's row never names it.
 */
export async function expenseTargetLabel(
  farmId: string,
  expense: {
    birdGroupId: string | null;
    motherHenId: string | null;
    incubationCycleId: string | null;
  },
): Promise<string | null> {
  if (expense.birdGroupId) {
    const group = await prisma.birdGroup.findFirst({
      where: { id: expense.birdGroupId, farmId },
      select: { name: true, breed: { select: { name: true } } },
    });
    return birdGroupLabel(group);
  }
  if (expense.motherHenId) {
    const hen = await prisma.motherHen.findFirst({
      where: { id: expense.motherHenId, farmId },
      select: { name: true },
    });
    return hen?.name ?? null;
  }
  if (expense.incubationCycleId) {
    const cycle = await prisma.incubationCycle.findFirst({
      where: { id: expense.incubationCycleId, farmId },
      select: { name: true, startDate: true },
    });
    return cycle ? cycleLabel(cycle) : null;
  }
  return null;
}
