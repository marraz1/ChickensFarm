/**
 * Bird-group choices for a form's group select.
 *
 * Most forms link a group optionally and label the option with the breed name
 * alone. Meat/food use requires a group, and the quantity is validated against
 * that exact group's head count, so two same-breed groups have to be tellable
 * apart — hence the group's own label when it has one, and its current count.
 */
export function birdGroupOptions(
  groups: { id: string; name: string | null; quantity: number; breed: { name: string } }[],
): { id: string; label: string }[] {
  return groups.map((g) => ({
    id: g.id,
    label: `${g.name ? `${g.name} · ${g.breed.name}` : g.breed.name} (${g.quantity})`,
  }));
}
