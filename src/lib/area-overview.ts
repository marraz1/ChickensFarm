// Small pure helpers behind the V2 area overviews (#187–#190), kept free of
// Prisma so they are unit-tested directly.

export type HenStatus = "Peri" | "Ilsisi" | "Nugaišusi";

/**
 * A mother hen's badge on the Perekšlės overview (#188): a dead hen is
 * "Nugaišusi" whatever else is recorded; otherwise she sits ("Peri") while she
 * has a cycle that has not hatched, and rests ("Ilsisi") between broods.
 */
export function henStatus(hen: { diedAt: Date | null }, sitting: boolean): HenStatus {
  if (hen.diedAt) return "Nugaišusi";
  return sitting ? "Peri" : "Ilsisi";
}

/** Which day of sitting today is: the start day is day 1. Dates are UTC midnights. */
export function sittingDay(startDate: Date, today: Date): number {
  return Math.max(1, Math.round((today.getTime() - startDate.getTime()) / 86_400_000) + 1);
}

export type FlockPart = { name: string; quantity: number };

/**
 * Head count per breed, largest first ("Brama 24 · Sussex 6"). Groups of the
 * same breed are merged; groups with no birds left are not listed.
 */
export function flockByBreed(groups: { quantity: number; breedName: string }[]): FlockPart[] {
  const byBreed = new Map<string, number>();
  for (const g of groups) {
    if (g.quantity > 0) byBreed.set(g.breedName, (byBreed.get(g.breedName) ?? 0) + g.quantity);
  }
  return [...byBreed]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "lt"));
}
