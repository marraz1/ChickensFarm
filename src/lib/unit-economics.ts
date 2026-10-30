// Each area's per-unit figure on its Finansai tab (#199, V2-<Area>-Finance).
// Pure, so it is unit-tested; getAreaUnitBase supplies the count it divides by.
//
// The formulas (designs' sample numbers, and the user's choice of counts):
// - Kiaušiniai: "Pelno marža", the result as a share of income;
// - Perekšlės: expenses per hen kept during the period;
// - Perinimas: expenses per chick hatched during the period;
// - Mėsa: expenses per bird handled during the period — those in Mėsa groups
//   now, plus those sold, used at home and lost in it.
// Money is divided in cents; nothing to divide by shows "—".
import type { AreaFinance } from "@/lib/area-finance";
import { formatEUR, formatShareLT } from "@/lib/format";
import { toCents } from "@/lib/finance-math";
import type { AreaSlug } from "@/lib/v2-navigation";

const NONE = "—";

export type UnitFigure = {
  /** Under the result (Kiaušiniai, Perinimas) or as the Išlaidos card's note (Perekšlės, Mėsa). */
  placement: "result" | "expenses";
  text: string;
};

/**
 * How many units an area's expenses are spread over: getAreaUnitBase's count,
 * plus, for Mėsa, the birds sold and used at home. Kiaušiniai has none (0).
 * Shared with the Mėsa Nuostoliai tab's feed value lost (#197).
 */
export function unitDivisor(area: AreaSlug, f: AreaFinance, base: number): number {
  return area === "meat" ? base + f.birdsSold + f.homeUse : area === "eggs" ? 0 : base;
}

/**
 * `base` is getAreaUnitBase's count: hens kept, chicks hatched, or Mėsa birds
 * now plus those lost. Kiaušiniai needs none.
 */
export function unitFigure(area: AreaSlug, f: AreaFinance, base: number): UnitFigure {
  const perUnit = (count: number) =>
    count > 0 ? formatEUR(Math.round(toCents(f.expenses) / count) / 100) : NONE;

  switch (area) {
    case "eggs": {
      const incomeCents = toCents(f.income);
      const margin = incomeCents > 0 ? formatShareLT(toCents(f.result) / incomeCents) : NONE;
      return { placement: "result", text: `Pelno marža ${margin}` };
    }
    case "hens":
      return {
        placement: "expenses",
        text: `${perUnit(unitDivisor(area, f, base))} vienai perekšlei`,
      };
    case "incubation":
      return {
        placement: "result",
        text: `Vieno išsiritusio jauniklio kaina ${perUnit(unitDivisor(area, f, base))}`,
      };
    case "meat":
      return {
        placement: "expenses",
        text: `${perUnit(unitDivisor(area, f, base))} vienam paukščiui`,
      };
  }
}
