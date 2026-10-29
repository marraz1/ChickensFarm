// An area's Finansai tab (#198, V2-<Area>-Finance): the period's result,
// income and expenses, spend by category and month by month. Pure, so it is
// unit-tested without a database; getAreaFinance feeds it.
//
// Where the money comes from is decided before it gets here: egg sales only
// reach Kiaušiniai, a bird transaction carries the area it was saved under
// (bird-transactions.ts → transactionArea), and an expense its own area.
// Everything is summed in cents, so the categories and the months add up to
// the totals above them and the four areas plus Bendra to the farm P&L.
import { toCents } from "@/lib/finance-math";
import { expenseCategoryLabels } from "@/lib/labels";
import { BIRD_PURCHASES_LABEL } from "@/lib/area-expenses";
import type { BirdTransactionType, ExpenseCategory } from "@/generated/prisma/client";

export type AreaFinanceInput = {
  /** Egg sales per day (Kiaušiniai only). */
  eggSales: { date: Date; amount: unknown }[];
  birdTransactions: {
    type: BirdTransactionType;
    date: Date;
    amount: unknown;
    quantity: number;
  }[];
  /** Expenses per day and category. */
  expenses: { date: Date; category: ExpenseCategory; amount: unknown }[];
  /** Birds of the area's groups used for the household's meat, per day — a count, never income. */
  homeUse: { date: Date; quantity: number }[];
  period: { from: Date; to: Date; today: Date };
};

export type AreaFinanceMonth = {
  year: number;
  /** 0-based, matching formatMonthLT. */
  month: number;
  income: number;
  expenses: number;
  result: number;
};

export type AreaFinance = {
  income: number;
  expenses: number;
  result: number;
  eggIncome: number;
  birdIncome: number;
  birdsSold: number;
  /** The bird-purchase share of `expenses`. */
  purchases: number;
  byCategory: { label: string; amount: number; share: number }[];
  /** Newest first, every month of the period up to today, empty ones as zero. */
  months: AreaFinanceMonth[];
  /** Whether the months span more than one year (labels then carry the year). */
  spansYears: boolean;
  homeUse: number;
  hasRecords: boolean;
};

const monthIndex = (date: Date) => date.getUTCFullYear() * 12 + date.getUTCMonth();

export function buildAreaFinance(input: AreaFinanceInput): AreaFinance {
  const { from, to, today } = input.period;
  const inPeriod = (date: Date) => date >= from && date <= to;

  // Month buckets of the period, oldest index first; records outside the
  // period (a caller passing a wider set) are ignored everywhere.
  const firstMonth = monthIndex(from);
  const capped = monthIndex(to < today ? to : today);
  const lastMonth = capped < firstMonth ? monthIndex(to) : capped;
  const buckets = new Map<number, { incomeCents: number; expensesCents: number }>();
  for (let m = firstMonth; m <= lastMonth; m++)
    buckets.set(m, { incomeCents: 0, expensesCents: 0 });
  const bucket = (date: Date) => {
    const key = monthIndex(date);
    let b = buckets.get(key);
    // A record dated after today but inside the period still gets its month.
    if (!b) buckets.set(key, (b = { incomeCents: 0, expensesCents: 0 }));
    return b;
  };

  let eggCents = 0;
  let birdCents = 0;
  let birdsSold = 0;
  let purchaseCents = 0;
  let recordCount = 0;
  const categoryCents = new Map<ExpenseCategory, number>();

  for (const sale of input.eggSales) {
    if (!inPeriod(sale.date)) continue;
    const cents = toCents(sale.amount);
    eggCents += cents;
    bucket(sale.date).incomeCents += cents;
    recordCount++;
  }
  for (const t of input.birdTransactions) {
    if (!inPeriod(t.date)) continue;
    const cents = toCents(t.amount);
    if (t.type === "SALE") {
      birdCents += cents;
      birdsSold += t.quantity;
      bucket(t.date).incomeCents += cents;
    } else {
      purchaseCents += cents;
      bucket(t.date).expensesCents += cents;
    }
    recordCount++;
  }
  for (const e of input.expenses) {
    if (!inPeriod(e.date)) continue;
    const cents = toCents(e.amount);
    categoryCents.set(e.category, (categoryCents.get(e.category) ?? 0) + cents);
    bucket(e.date).expensesCents += cents;
    recordCount++;
  }

  const incomeCents = eggCents + birdCents;
  const expensesCents =
    [...categoryCents.values()].reduce((sum, cents) => sum + cents, 0) + purchaseCents;

  // Bought birds have no ExpenseCategory, so they join the breakdown as their
  // own row — otherwise the rows would not add up to the total they share.
  const parts: [string, number][] = [
    ...[...categoryCents].map(([category, cents]): [string, number] => [
      expenseCategoryLabels[category],
      cents,
    ]),
    [BIRD_PURCHASES_LABEL, purchaseCents],
  ];
  const byCategory = parts
    .filter(([, cents]) => cents !== 0)
    .sort(([la, a], [lb, b]) => b - a || la.localeCompare(lb, "lt"))
    .map(([label, cents]) => ({
      label,
      amount: cents / 100,
      share: expensesCents === 0 ? 0 : cents / expensesCents,
    }));

  const months = [...buckets]
    .sort(([a], [b]) => b - a)
    .map(([key, b]) => ({
      year: Math.floor(key / 12),
      month: key % 12,
      income: b.incomeCents / 100,
      expenses: b.expensesCents / 100,
      result: (b.incomeCents - b.expensesCents) / 100,
    }));

  return {
    income: incomeCents / 100,
    expenses: expensesCents / 100,
    result: (incomeCents - expensesCents) / 100,
    eggIncome: eggCents / 100,
    birdIncome: birdCents / 100,
    birdsSold,
    purchases: purchaseCents / 100,
    byCategory,
    months,
    spansYears: new Set(months.map((m) => m.year)).size > 1,
    homeUse: input.homeUse.reduce((sum, h) => (inPeriod(h.date) ? sum + h.quantity : sum), 0),
    hasRecords: recordCount > 0,
  };
}
