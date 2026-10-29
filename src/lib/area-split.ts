// The overview's "Pagal sritį" donut (#202, V2-Overview): the farm's spending
// or income split by area. Pure on purpose (no React), so it is unit-tested;
// the card in src/components/v2/area-split-card.tsx only draws what this says.
import type { FarmArea } from "@/generated/prisma/client";
import { formatEUR, formatShareLT } from "@/lib/format";
import { farmAreaOrder } from "@/lib/labels";

/**
 * Each area's short name and colour, the same in both views. Colours are fixed
 * per area, never by rank (README § Area colours); three sit below 3:1 on
 * white, so every slice also has its percentage as text in the legend.
 */
export const AREA_CHART: Record<FarmArea, { short: string; color: string }> = {
  EGGS: { short: "Kiaušiniai", color: "#2a78d6" },
  HENS: { short: "Perekšlės", color: "#eb6834" },
  INC: { short: "Perinimas", color: "#1baf7a" },
  MEAT: { short: "Mėsa", color: "#eda100" },
  SHARED: { short: "Bendros", color: "#e87ba4" },
};

export type SplitMode = "expenses" | "income";

export type AreaSplitPart = {
  area: FarmArea;
  short: string;
  color: string;
  amount: number;
  /** 0..1 of the total; 0 when the total is 0. */
  share: number;
};

export type AreaSplit = { total: number; parts: AreaSplitPart[] };

/** Every area, in display order, with its share of the farm's spending or income. */
export function areaSplit(
  areas: Record<FarmArea, { income: number; expenses: number }>,
  mode: SplitMode,
): AreaSplit {
  const cents = farmAreaOrder.map((area) => Math.round(areas[area][mode] * 100));
  const totalCents = cents.reduce((sum, c) => sum + c, 0);
  return {
    total: totalCents / 100,
    parts: farmAreaOrder.map((area, i) => ({
      area,
      ...AREA_CHART[area],
      amount: cents[i] / 100,
      share: totalCents > 0 ? cents[i] / totalCents : 0,
    })),
  };
}

export type DonutSegment = { area: FarmArea; color: string; dash: string; offset: string };

/** The gap left between two slices, in the ring's units. */
const SLICE_GAP = 2;

/**
 * One ring stroke per area with money, laid end to end from the top. Each
 * dash is its arc less a small gap (never below half a unit, so a sliver still
 * shows), followed by the whole circumference so it is drawn once.
 */
export function donutSegments(parts: readonly AreaSplitPart[], radius: number): DonutSegment[] {
  const circumference = 2 * Math.PI * radius;
  const segments: DonutSegment[] = [];
  let start = 0;
  for (const part of parts) {
    if (part.share <= 0) continue;
    const length = part.share * circumference;
    segments.push({
      area: part.area,
      color: part.color,
      dash: `${Math.max(length - SLICE_GAP, 0.5)} ${circumference}`,
      offset: String(-start),
    });
    start += length;
  }
  return segments;
}

export const splitWord = (mode: SplitMode) => (mode === "expenses" ? "Išlaidos" : "Pajamos");

/** The chart's text alternative: every area's amount and share. */
export function splitTextAlternative(split: AreaSplit, mode: SplitMode): string {
  const list = split.parts
    .map((p) => `${p.short} ${formatEUR(p.amount)} (${formatShareLT(p.share)})`)
    .join(", ");
  return `${splitWord(mode)} pagal sritį: ${list}`;
}
