// Small pure helpers behind the V2 area overviews (#187–#190), kept free of
// Prisma so they are unit-tested directly.

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
