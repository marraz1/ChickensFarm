// An area's Nuostoliai tab (#196, V2-<Area>-Losses): the year's dead birds
// split by cause, and every loss of the area, newest first. Pure, so it is
// unit-tested without a database; getAreaLosses feeds it.
//
// Only Loss records count. Meat used at home is a separate record and never a
// loss (finance model); area-specific extras such as broken eggs are #197.
import { lossReasonLabels } from "@/lib/labels";
import { formatLongDateLT } from "@/lib/format";
import type { AreaSlug } from "@/lib/v2-navigation";
import type { LossReasonType } from "@/generated/prisma/client";

export type AreaLossInput = {
  id: string;
  reasonType: LossReasonType;
  quantity: number;
  lossDate: Date;
  createdAt: Date;
  comment: string | null;
  /** Name of the group, mother hen or cycle it was recorded against, if any. */
  targetName: string | null;
};

export type AreaLossRow = {
  key: string;
  title: string;
  detail: string | null;
  quantity: number;
  href: string;
};

export type AreaLossSummary = {
  year: number;
  total: number;
  /** All three causes, in design order, even at 0. */
  byReason: { reason: LossReasonType; label: string; count: number }[];
  rows: AreaLossRow[];
  /** More losses than the list shows; the farm-wide list has them all. */
  hasMore: boolean;
};

/** How many records the tab lists; older ones are on the farm-wide list. */
export const AREA_LOSS_LIST_LIMIT = 50;

type Forms = readonly [string, string, string];

const BIRDS: Forms = ["paukštis", "paukščiai", "paukščių"];
const NONE_THIS_YEAR = "Šiais metais nuostolių nebuvo.";

/**
 * What each area calls its losses (designs V2-<Area>-Losses). `empty` is
 * shown when the year has none; older records are still listed below it.
 */
export const AREA_LOSS_COPY: Record<AreaSlug, { heading: string; unit: Forms; empty: string }> = {
  eggs: { heading: "Nugaišo", unit: BIRDS, empty: NONE_THIS_YEAR },
  hens: { heading: "Nugaišo", unit: BIRDS, empty: "Šiais metais perekšlių nuostolių nebuvo." },
  incubation: {
    heading: "Žuvę jaunikliai",
    unit: ["jauniklis", "jaunikliai", "jauniklių"],
    empty: NONE_THIS_YEAR,
  },
  meat: { heading: "Nugaišo", unit: BIRDS, empty: NONE_THIS_YEAR },
};

const REASON_ORDER: LossReasonType[] = ["DISEASE", "PREDATOR", "OTHER"];

/** The extra card each area's tab shows under its dead birds (#197). */
export type AreaLossInsight =
  /** Kiaušiniai: broken eggs from this month's collections; Perekšlės: from the hen diary, this year. */
  | { kind: "broken"; count: number }
  /** Perinimas, this year: eggs found infertile, and fertile eggs that did not hatch. */
  | { kind: "unhatched"; infertile: number; unhatched: number }
  /** Mėsa, this year: birds lost and the feed they took, at the cost per bird; null when it cannot be worked out. */
  | { kind: "feed"; lost: number; valueCents: number | null };

/**
 * Fertile eggs that did not hatch, over hatched cycles. A cycle without both
 * counts is skipped, and one that reports more chicks than fertile eggs
 * counts as none rather than taking from the others.
 */
export function unhatchedEggs(
  cycles: readonly { eggsFertile: number | null; hatchedCount: number | null }[],
): number {
  return cycles.reduce(
    (sum, c) =>
      c.eggsFertile == null || c.hatchedCount == null
        ? sum
        : sum + Math.max(c.eggsFertile - c.hatchedCount, 0),
    0,
  );
}

/**
 * The feed value of the birds lost (design: "Apytiksliai, pagal vidutines
 * išlaidas vienam paukščiui"): the expenses per bird, as the Finansai tab's
 * "vienam paukščiui" (#199), times the birds lost. Null with no birds to
 * divide by.
 */
export function feedValueLostCents(
  expensesCents: number,
  birds: number,
  lost: number,
): number | null {
  return birds > 0 ? Math.round((expensesCents * lost) / birds) : null;
}

export function buildAreaLossSummary(input: {
  year: number;
  /** The year's birds lost per cause (counted in the database). */
  yearCounts: Partial<Record<LossReasonType, number>>;
  /** The newest losses, up to the list limit (one more tells there are more). */
  losses: AreaLossInput[];
  /** Added to row links so the edit screen returns to this area (`?area=<slug>`). */
  linkQuery?: string;
}): AreaLossSummary {
  const q = input.linkQuery ?? "";

  const byReason = REASON_ORDER.map((reason) => ({
    reason,
    label: lossReasonLabels[reason],
    count: input.yearCounts[reason] ?? 0,
  }));

  // The list: newest first; same day → the one entered last first.
  const rows = [...input.losses]
    .sort(
      (a, b) =>
        b.lossDate.getTime() - a.lossDate.getTime() ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    )
    .slice(0, AREA_LOSS_LIST_LIMIT)
    .map((l) => ({
      key: l.id,
      title: `${lossReasonLabels[l.reasonType]} · ${formatLongDateLT(l.lossDate)}`,
      detail: [l.targetName, l.comment].filter(Boolean).join(" · ") || null,
      quantity: l.quantity,
      href: `/losses/${l.id}/edit${q}`,
    }));

  return {
    year: input.year,
    total: byReason.reduce((sum, r) => sum + r.count, 0),
    byReason,
    rows,
    hasMore: input.losses.length > AREA_LOSS_LIST_LIMIT,
  };
}
