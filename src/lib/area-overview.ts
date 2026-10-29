// Small pure helpers behind the V2 area overviews (#187–#190), kept free of
// Prisma so they are unit-tested directly.
import { countNounLT, formatLongDateLT } from "@/lib/format";
import type { NewRecordLink } from "@/lib/v2-navigation";

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

/** "1 kiaušinis", "2 kiaušiniai", "12 kiaušinių" (countNounLT forms). */
export const EGGS = ["kiaušinis", "kiaušiniai", "kiaušinių"] as const;

/**
 * The "Peri dabar" line (#188): "8 kiaušiniai · 6-a diena" for one sitting
 * hen (eggs left out when unknown), the hens' names for several.
 */
export function sittingDetail(
  sitting: readonly { name: string; eggs: number | null; day: number }[],
): string {
  if (sitting.length === 0) return "Šiuo metu niekas neperi";
  if (sitting.length > 1) return sitting.map((s) => s.name).join(" · ");
  const [{ eggs, day }] = sitting;
  // Lithuanian ordinal with the feminine "-a" of "diena".
  return [eggs != null && countNounLT(eggs, EGGS), `${day}-a diena`].filter(Boolean).join(" · ");
}

// --- Perinimas (#189) ---------------------------------------------------------

export type CycleStatus = "Pradėta" | "Apšviesta" | "Išsiritę";

type CycleFacts = {
  hatchDate: Date | null;
  eggsFertile: number | null;
  hatchedCount: number | null;
};

/** A cycle's badge: hatched (finished raising included), else candled, else started. */
export function cycleStatus(cycle: CycleFacts): CycleStatus {
  if (cycle.hatchDate) return "Išsiritę";
  if (cycle.eggsFertile != null) return "Apšviesta";
  return "Pradėta";
}

/**
 * "Efektyvumas": chicks hatched out of the fertile eggs, over hatched cycles
 * only — a cycle candled but not hatched yet has fertile eggs and no result,
 * and would drag the rate down. `rate` is null with no fertile eggs yet;
 * `anyHatched` tells "nothing hatched" from "hatched, but never candled".
 */
export function hatchEfficiency(cycles: readonly CycleFacts[]) {
  let hatched = 0;
  let fertile = 0;
  let anyHatched = false;
  for (const c of cycles) {
    if (c.hatchDate) anyHatched = true;
    if (!c.hatchDate || c.eggsFertile == null || c.hatchedCount == null) continue;
    hatched += c.hatchedCount;
    fertile += c.eggsFertile;
  }
  return { hatched, fertile, rate: fertile > 0 ? hatched / fertile : null, anyHatched };
}

/**
 * The lines of a cycle card: when it started (and, while it runs, which day
 * it is), where the eggs came from, and once hatched how many chicks, how many
 * are alive now and whether their raising is finished.
 */
export function cycleCardLines(
  cycle: CycleFacts & {
    startDate: Date;
    eggsTotal: number | null;
    henName: string | null;
    sourceBreed: string | null;
    sourceDescription: string | null;
    latestAlive: number | null;
    growthCompletedAt: Date | null;
  },
  today: Date,
): { started: string; source: string; result: string | null } {
  const started = [
    `Pradėta ${formatLongDateLT(cycle.startDate)}`,
    !cycle.hatchDate && `${sittingDay(cycle.startDate, today)}-a diena`,
  ]
    .filter(Boolean)
    .join(" · ");

  const from = cycle.henName
    ? `Perekšlė ${cycle.henName}`
    : cycle.sourceBreed
      ? `Šaltinis: ${cycle.sourceBreed}`
      : cycle.sourceDescription || "Šaltinis nenurodytas";
  const source = [from, cycle.eggsTotal != null && countNounLT(cycle.eggsTotal, EGGS)]
    .filter(Boolean)
    .join(" · ");

  const result =
    cycle.hatchDate && cycle.hatchedCount != null
      ? [
          `Išsirito ${cycle.hatchedCount}`,
          cycle.latestAlive != null && `dabar gyvų ${cycle.latestAlive}`,
          // Tells a finished raising from one still needing growth entries.
          cycle.growthCompletedAt && "auginimas baigtas",
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return { started, source, result };
}

/**
 * The Perinimas sheet with its per-cycle actions pointed at the cycle when
 * exactly one fits — candling and the hatch are on a running cycle's page, a
 * growth entry belongs to a hatched cycle still being raised. Otherwise they
 * keep their base link, the cycle list, to pick one.
 */
export function incubationSheetItems(
  base: readonly NewRecordLink[],
  cycles: { active: readonly string[]; growing: readonly string[] },
): { href: string; label: string }[] {
  const only = (ids: readonly string[]) => (ids.length === 1 ? ids[0] : null);
  const active = only(cycles.active);
  const growing = only(cycles.growing);
  return base.map(({ href, label, cycle }) => {
    if (cycle === "active" && active) return { label, href: `/incubation/${active}` };
    if (cycle === "growing" && growing) {
      return { label, href: `/incubation/${growing}/growth-logs/new` };
    }
    return { label, href };
  });
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
