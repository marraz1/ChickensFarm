// An area's Išlaidos tab (#194, V2-<Area>-Expenses): the year's total with a
// per-category breakdown, and every record of the area, newest first. Pure, so
// it is unit-tested without a database; getAreaExpenses feeds it.
//
// Bird purchases count in Kiaušiniai only — "Kiaušiniai ir prekyba" covers all
// bird trade (decision on #194, matching the designs) — whatever group they
// went into. #198 (area finances) uses the same rule.
import { toCents } from "@/lib/finance-math";
import { expenseCategoryLabels } from "@/lib/labels";
import { formatDateLT, formatLongDateLT } from "@/lib/format";
import type { ExpenseCategory, FarmArea } from "@/generated/prisma/client";

export type AreaExpenseInput = {
  id: string;
  category: ExpenseCategory;
  amount: unknown; // Decimal | string | number
  expenseDate: Date;
  createdAt: Date;
  description: string | null;
  /** Name of the group, mother hen or cycle it points at, if any. */
  targetName: string | null;
};

export type AreaPurchaseInput = {
  id: string;
  totalAmount: unknown;
  quantity: number;
  transactionDate: Date;
  createdAt: Date;
  /** The group's name, else its breed's, else null for an unlinked purchase. */
  groupLabel: string | null;
};

export type AreaExpenseRow = {
  key: string;
  title: string;
  detail: string | null;
  amount: number;
  href: string;
};

export type AreaExpenseSummary = {
  year: number;
  total: number;
  breakdown: { label: string; amount: number }[];
  rows: AreaExpenseRow[];
};

export const BIRD_PURCHASES_LABEL = "Paukščių pirkimai";

/** Whether an area's expenses include the farm's bird purchases. */
export function areaCountsPurchases(area: FarmArea): boolean {
  return area === "EGGS";
}

/** A bird group as rows name it: its own name, else its breed's. */
export function birdGroupLabel(
  group: { name: string | null; breed?: { name: string } | null } | null | undefined,
): string | null {
  return group?.name || group?.breed?.name || null;
}

/** An incubation cycle as lists name it: its own name, else when it started. */
export function cycleLabel(cycle: { name: string | null; startDate: Date }): string {
  return cycle.name || `Ciklas nuo ${formatDateLT(cycle.startDate)}`;
}

export function buildAreaExpenseSummary(input: {
  area: FarmArea;
  year: number;
  expenses: AreaExpenseInput[];
  purchases: AreaPurchaseInput[];
  /** Added to row links so edit screens return to this area (`?area=<slug>`). */
  linkQuery?: string;
}): AreaExpenseSummary {
  const purchases = areaCountsPurchases(input.area) ? input.purchases : [];
  const q = input.linkQuery ?? "";
  const inYear = (date: Date) => date.getUTCFullYear() === input.year;

  // The card: this year only, summed in cents so the parts add up.
  const centsByLabel = new Map<string, number>();
  const add = (label: string, cents: number) =>
    centsByLabel.set(label, (centsByLabel.get(label) ?? 0) + cents);
  for (const e of input.expenses) {
    if (inYear(e.expenseDate)) add(expenseCategoryLabels[e.category], toCents(e.amount));
  }
  for (const p of purchases) {
    if (inYear(p.transactionDate)) add(BIRD_PURCHASES_LABEL, toCents(p.totalAmount));
  }
  // Total and breakdown come from the same buckets; a bucket netting to zero
  // is left out of the list, which leaves the sum unchanged.
  const buckets = [...centsByLabel].filter(([, cents]) => cents !== 0);
  const breakdown = buckets
    .sort(([la, a], [lb, b]) => b - a || la.localeCompare(lb, "lt"))
    .map(([label, cents]) => ({ label, amount: cents / 100 }));
  const totalCents = buckets.reduce((sum, [, cents]) => sum + cents, 0);

  // The list: every record, newest first. Same day: expenses before purchases,
  // then newest entered first, so the order never shuffles between loads.
  type Sortable = AreaExpenseRow & { date: Date; kind: 0 | 1; createdAt: Date };
  const rows: Sortable[] = [
    ...input.expenses.map((e) => ({
      key: `expense-${e.id}`,
      title: `${expenseCategoryLabels[e.category]} · ${formatLongDateLT(e.expenseDate)}`,
      detail: [e.targetName, e.description].filter(Boolean).join(" · ") || null,
      amount: toCents(e.amount) / 100,
      href: `/expenses/${e.id}/edit${q}`,
      date: e.expenseDate,
      kind: 0 as const,
      createdAt: e.createdAt,
    })),
    ...purchases.map((p) => ({
      key: `purchase-${p.id}`,
      title: `Paukščių pirkimas · ${formatLongDateLT(p.transactionDate)}`,
      detail: [`${p.quantity} vnt.`, p.groupLabel, "iš pirkimų"].filter(Boolean).join(" · "),
      amount: toCents(p.totalAmount) / 100,
      href: `/birds/purchases/${p.id}/edit${q}`,
      date: p.transactionDate,
      kind: 1 as const,
      createdAt: p.createdAt,
    })),
  ];
  rows.sort(
    (a, b) =>
      b.date.getTime() - a.date.getTime() ||
      a.kind - b.kind ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return {
    year: input.year,
    total: totalCents / 100,
    breakdown,
    rows: rows.map(({ key, title, detail, amount, href }) => ({
      key,
      title,
      detail,
      amount,
      href,
    })),
  };
}
