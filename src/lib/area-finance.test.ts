import { describe, expect, it } from "vitest";
import { buildAreaFinance, type AreaFinanceInput } from "@/lib/area-finance";
import { formatShareLT } from "@/lib/format";

const day = (s: string) => new Date(`${s}T00:00:00Z`);
const YEAR = { from: day("2026-01-01"), to: day("2026-12-31"), today: day("2026-03-15") };

function build(partial: Partial<AreaFinanceInput>) {
  return buildAreaFinance({
    eggSales: [],
    birdTransactions: [],
    expenses: [],
    homeUse: [],
    period: YEAR,
    ...partial,
  });
}

describe("buildAreaFinance", () => {
  it("adds egg and bird sales as income, expenses and purchases as expenses", () => {
    const f = build({
      eggSales: [{ date: day("2026-01-10"), amount: "100.00" }],
      birdTransactions: [
        { type: "SALE", date: day("2026-02-01"), amount: "40.00", quantity: 4 },
        { type: "PURCHASE", date: day("2026-02-02"), amount: "30.00", quantity: 3 },
      ],
      expenses: [{ date: day("2026-01-05"), category: "FEED", amount: "50.00" }],
    });
    expect(f).toMatchObject({
      income: 140,
      eggIncome: 100,
      birdIncome: 40,
      birdsSold: 4,
      expenses: 80,
      purchases: 30,
      result: 60,
      hasRecords: true,
    });
  });

  it("gives a negative result when expenses exceed income", () => {
    const f = build({
      expenses: [{ date: day("2026-02-01"), category: "MEDICINE", amount: 12.5 }],
    });
    expect(f.result).toBe(-12.5);
    expect(f.income).toBe(0);
  });

  it("sums in cents so totals do not drift", () => {
    const f = build({
      expenses: [
        { date: day("2026-01-01"), category: "OTHER", amount: 0.1 },
        { date: day("2026-01-02"), category: "OTHER", amount: 0.2 },
      ],
    });
    expect(f.expenses).toBe(0.3);
    expect(f.byCategory).toEqual([{ label: "Kita", amount: 0.3, share: 1 }]);
  });

  it("lists categories largest first with purchases as their own row, shares adding to 1", () => {
    const f = build({
      birdTransactions: [{ type: "PURCHASE", date: day("2026-01-03"), amount: 136, quantity: 2 }],
      expenses: [
        { date: day("2026-01-01"), category: "FEED", amount: 1000 },
        { date: day("2026-02-01"), category: "FEED", amount: 40 },
        { date: day("2026-02-01"), category: "VITAMINS", amount: 70 },
      ],
    });
    expect(f.byCategory.map((c) => [c.label, c.amount])).toEqual([
      ["Pašarai", 1040],
      ["Paukščių pirkimai", 136],
      ["Vitaminai", 70],
    ]);
    expect(f.byCategory.reduce((sum, c) => sum + c.amount, 0)).toBe(f.expenses);
    expect(f.byCategory.reduce((sum, c) => sum + c.share, 0)).toBeCloseTo(1, 10);
    expect(formatShareLT(f.byCategory[0].share)).toMatch(/^83,5\s?%$/);
  });

  it("lists every month up to today, newest first, with empty months as zero", () => {
    const f = build({ expenses: [{ date: day("2026-01-20"), category: "FEED", amount: 10 }] });
    expect(f.months).toEqual([
      { year: 2026, month: 2, income: 0, expenses: 0, result: 0 },
      { year: 2026, month: 1, income: 0, expenses: 0, result: 0 },
      { year: 2026, month: 0, income: 0, expenses: 10, result: -10 },
    ]);
    expect(f.spansYears).toBe(false);
  });

  it("marks months across years, and lists a past range to its end", () => {
    const f = build({
      period: { from: day("2025-11-15"), to: day("2026-01-10"), today: day("2026-03-15") },
    });
    expect(f.months.map((m) => `${m.year}-${m.month}`)).toEqual(["2026-0", "2025-11", "2025-10"]);
    expect(f.spansYears).toBe(true);
  });

  it("ignores records outside the period", () => {
    const f = build({
      eggSales: [{ date: day("2025-12-31"), amount: 5 }],
      expenses: [{ date: day("2027-01-01"), category: "FEED", amount: 5 }],
    });
    expect(f).toMatchObject({ income: 0, expenses: 0, hasRecords: false });
    expect(f.byCategory).toEqual([]);
  });

  it("passes home use through as a count only", () => {
    const f = build({
      homeUse: [
        { date: day("2026-02-01"), quantity: 9 },
        // Outside the period, so not counted.
        { date: day("2025-12-31"), quantity: 5 },
      ],
    });
    expect(f).toMatchObject({ homeUse: 9, income: 0, hasRecords: false });
  });
});
