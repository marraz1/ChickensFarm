import { prisma } from "@/lib/prisma";
import { birdGroupOptions } from "@/lib/bird-group-options";
import { formatDateLT } from "@/lib/format";
import type { AreaSlug } from "@/lib/v2-navigation";

export type TargetOption = { id: string; label: string };

/**
 * What a new expense in an area can point at (#192): only the active farm's
 * current targets in that area, as select options.
 *
 * "Current" means it can still incur costs: a group with birds in it, a living
 * mother hen, an incubation cycle whose chick tracking is not finished. The
 * server accepts any target of the farm and area (#179) — this only keeps
 * defunct ones out of the list. Lean selects: just what the labels need.
 */
export async function listExpenseTargetOptions(
  farmId: string,
  area: AreaSlug,
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
          where: { farmId, growthCompletedAt: null },
          select: { id: true, name: true, startDate: true },
          orderBy: { startDate: "desc" },
        })
      ).map((cycle) => ({
        id: cycle.id,
        label: cycle.name || `Ciklas nuo ${formatDateLT(cycle.startDate)}`,
      }));
  }
}
