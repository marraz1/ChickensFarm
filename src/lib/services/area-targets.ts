import { prisma } from "@/lib/prisma";
import { birdGroupOptions } from "@/lib/bird-group-options";
import { cycleLabel } from "@/lib/area-expenses";
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
