import { describe, expect, it } from "vitest";
import { farmStats } from "@/lib/farm-stats";
import type { AreaFinance, AreaFinanceMonth } from "@/lib/area-finance";
import type { FarmArea } from "@/generated/prisma/client";

function finance(overrides: Partial<AreaFinance> = {}): AreaFinance {
  return {
    income: 0,
    expenses: 0,
    result: 0,
    eggIncome: 0,
    birdIncome: 0,
    birdsSold: 0,
    purchases: 0,
    byCategory: [],
    months: [],
    spansYears: false,
    homeUse: 0,
    hasRecords: false,
    ...overrides,
  };
}

const month = (year: number, m: number, income: number, expenses: number): AreaFinanceMonth => ({
  year,
  month: m,
  income,
  expenses,
  result: income - expenses,
});

const cat = (label: string, amount: number) => ({ label, amount, share: 0 });

function farm(overrides: Partial<Record<FarmArea, AreaFinance>> = {}) {
  return {
    EGGS: finance(),
    HENS: finance(),
    INC: finance(),
    MEAT: finance(),
    SHARED: finance(),
    ...overrides,
  };
}

describe("farmStats categories", () => {
  it("merges every area's categories, Bendra and bird purchases included, in cents", () => {
    const { categories } = farmStats(
      farm({
        EGGS: finance({ byCategory: [cat("Pašarai", 0.1), cat("Paukščių pirkimai", 136)] }),
        MEAT: finance({ byCategory: [cat("Pašarai", 0.2), cat("Vitaminai", 94)] }),
        SHARED: finance({ byCategory: [cat("Kita", 140)] }),
      }),
    );
    expect(categories.map((c) => [c.label, c.amount])).toEqual([
      ["Kita", 140],
      ["Paukščių pirkimai", 136],
      ["Vitaminai", 94],
      ["Pašarai", 0.3],
    ]);
    const cents = categories.reduce((sum, c) => sum + Math.round(c.amount * 100), 0);
    expect(cents).toBe(37030);
  });

  it("gives each category its share of the total and a bar against the biggest", () => {
    const { categories } = farmStats(
      farm({ EGGS: finance({ byCategory: [cat("Pašarai", 60), cat("Vaistai", 15)] }) }),
    );
    expect(categories).toEqual([
      { label: "Pašarai", amount: 60, share: 0.8, bar: 1 },
      { label: "Vaistai", amount: 15, share: 0.2, bar: 0.25 },
    ]);
  });

  it("is empty for a period with no spending", () => {
    expect(farmStats(farm()).categories).toEqual([]);
  });
});

describe("farmStats months", () => {
  it("adds the areas month by month, newest first", () => {
    const { months } = farmStats(
      farm({
        EGGS: finance({ months: [month(2026, 9, 160.4, 112), month(2026, 8, 180, 140)] }),
        SHARED: finance({ months: [month(2026, 9, 0, 30), month(2026, 8, 0, 65)] }),
      }),
    );
    expect(months).toEqual([
      { key: "2026-9", label: "Spalis", income: 160.4, expenses: 142, result: 18.4 },
      { key: "2026-8", label: "Rugsėjis", income: 180, expenses: 205, result: -25 },
    ]);
  });

  it("names the year only when the months span two", () => {
    const { months } = farmStats(
      farm({ EGGS: finance({ months: [month(2026, 0, 1, 0), month(2025, 11, 0, 1)] }) }),
    );
    expect(months.map((m) => m.label)).toEqual(["Sausis 2026", "Gruodis 2025"]);
  });

  it("tells a period with records from one of empty months", () => {
    const empty = finance({ months: [month(2026, 9, 0, 0)] });
    expect(farmStats(farm({ EGGS: empty, SHARED: empty })).hasRecords).toBe(false);
    expect(farmStats(farm({ SHARED: finance({ hasRecords: true }) })).hasRecords).toBe(true);
  });
});
