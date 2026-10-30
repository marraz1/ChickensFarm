// The overview's "Sritys" tiles (#203, V2-Overview): one tile per area with its
// result for the period, opening to its top expenses, losses, last three
// months and links. Pure on purpose (no React), so it is unit-tested; the tiles
// in src/components/v2/area-tiles.tsx only draw what this says.
import type { FarmArea } from "@/generated/prisma/client";
import type { AreaFinance } from "@/lib/area-finance";
import { AREA_LOSS_COPY } from "@/lib/area-losses";
import { AREA_CHART } from "@/lib/area-split";
import { countNounLT, formatMonthLT, formatMonthYearLT } from "@/lib/format";
import { farmAreaLabels, farmAreaOrder } from "@/lib/labels";
import { AREA_SLUGS, areaSlugFor, areaTabHref } from "@/lib/v2-navigation";
import type { LossArea } from "@/lib/services/losses";

/** The design shows up to three of each. */
const TOP_CATEGORIES = 3;
const MONTHS = 3;

export type AreaTile = {
  area: FarmArea;
  name: string;
  color: string;
  income: number;
  expenses: number;
  result: number;
  topCategories: { label: string; amount: number }[];
  /** "2 paukščiai"; null for Bendros, which loses no birds. */
  losses: string | null;
  /** Newest first, the period's last three months at most; labelled with the year only when they span two. */
  months: { key: string; label: string; result: number }[];
  /** The area's own screens; null for Bendros, which has none. */
  links: { overview: string; finance: string } | null;
  /** Bendros' second line: what its money went on ("Elektra, tvoros"). */
  sharedNote: string | null;
};

export function areaTiles(
  areas: Record<FarmArea, AreaFinance>,
  losses: Record<LossArea, number>,
): AreaTile[] {
  return farmAreaOrder.map((area) => {
    const finance = areas[area];
    // Null for Bendros, which has no screens and loses no birds.
    const slug = areaSlugFor(area);
    const topCategories = finance.byCategory
      .slice(0, TOP_CATEGORIES)
      .map(({ label, amount }) => ({ label, amount }));
    const months = finance.months.slice(0, MONTHS);
    // The year only when the months shown span two of them.
    const withYear = new Set(months.map((m) => m.year)).size > 1;
    return {
      area,
      name: area === "SHARED" ? "Bendros išlaidos" : farmAreaLabels[area],
      color: AREA_CHART[area].color,
      income: finance.income,
      expenses: finance.expenses,
      result: finance.result,
      topCategories,
      losses: slug ? countNounLT(losses[AREA_SLUGS[slug]], AREA_LOSS_COPY[slug].unit) : null,
      months: months.map((m) => ({
        key: `${m.year}-${m.month}`,
        label: withYear ? formatMonthYearLT(m.year, m.month) : formatMonthLT(m.month),
        result: m.result,
      })),
      links: slug
        ? { overview: areaTabHref(slug, null), finance: areaTabHref(slug, "finance") }
        : null,
      sharedNote: area === "SHARED" ? sharedNote(topCategories) : null,
    };
  });
}

function sharedNote(categories: { label: string }[]): string {
  if (categories.length === 0) return "Išlaidų nėra";
  return categories
    .map(({ label }, i) => (i === 0 ? label : label.toLocaleLowerCase("lt")))
    .join(", ");
}
