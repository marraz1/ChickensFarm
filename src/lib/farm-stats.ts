// The overview's "Daugiau statistikos" (#204, V2-Overview): the period's spend
// by category and its months, for the whole farm. Pure on purpose (no React),
// so it is unit-tested; src/components/v2/more-stats.tsx only draws it.
//
// Built from the areas getFarmFinance already returns, summed in cents, so the
// categories add up to the farm's expenses in the result card above them.
import type { FarmArea } from "@/generated/prisma/client";
import type { AreaFinance } from "@/lib/area-finance";
import { toCents } from "@/lib/finance-math";
import { formatMonthLT, formatMonthYearLT } from "@/lib/format";
import { farmAreaOrder } from "@/lib/labels";

export type FarmStats = {
  /** Biggest first; `share` of the farm's expenses, `bar` of the biggest category (0..1). */
  categories: { label: string; amount: number; share: number; bar: number }[];
  /** Newest first, every month of the period. */
  months: { key: string; label: string; income: number; expenses: number; result: number }[];
  /** Any money recorded in the period; without it the months are all zero. */
  hasRecords: boolean;
};

export function farmStats(areas: Record<FarmArea, AreaFinance>): FarmStats {
  const categoryCents = new Map<string, number>();
  const monthCents = new Map<
    number,
    { year: number; month: number; income: number; expenses: number }
  >();

  for (const area of farmAreaOrder) {
    for (const c of areas[area].byCategory) {
      categoryCents.set(c.label, (categoryCents.get(c.label) ?? 0) + toCents(c.amount));
    }
    // Every area lists the same months for a period; merged, they are the farm's.
    for (const m of areas[area].months) {
      const key = m.year * 12 + m.month;
      const sum = monthCents.get(key) ?? { year: m.year, month: m.month, income: 0, expenses: 0 };
      sum.income += toCents(m.income);
      sum.expenses += toCents(m.expenses);
      monthCents.set(key, sum);
    }
  }

  const sorted = [...categoryCents]
    .filter(([, cents]) => cents !== 0)
    .sort(([la, a], [lb, b]) => b - a || la.localeCompare(lb, "lt"));
  const totalCents = sorted.reduce((sum, [, cents]) => sum + cents, 0);
  const biggest = sorted[0]?.[1] ?? 0;

  const months = [...monthCents].sort(([a], [b]) => b - a).map(([, m]) => m);
  const spansYears = new Set(months.map((m) => m.year)).size > 1;

  return {
    categories: sorted.map(([label, cents]) => ({
      label,
      amount: cents / 100,
      share: totalCents === 0 ? 0 : cents / totalCents,
      bar: biggest === 0 ? 0 : cents / biggest,
    })),
    months: months.map((m) => ({
      key: `${m.year}-${m.month}`,
      label: spansYears ? formatMonthYearLT(m.year, m.month) : formatMonthLT(m.month),
      income: m.income / 100,
      expenses: m.expenses / 100,
      result: (m.income - m.expenses) / 100,
    })),
    hasRecords: farmAreaOrder.some((area) => areas[area].hasRecords),
  };
}
