import { describe, expect, it } from "vitest";
import {
  buildAreaExpenseSummary,
  type AreaExpenseInput,
  type AreaPurchaseInput,
} from "./area-expenses";
import { formatLongDateLT } from "./format";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`); // as @db.Date comes back
let seq = 0;

function expense(over: Partial<AreaExpenseInput> = {}): AreaExpenseInput {
  seq += 1;
  return {
    id: `e${seq}`,
    category: "FEED",
    amount: "10.00",
    expenseDate: day("2026-10-01"),
    createdAt: new Date(Date.UTC(2026, 9, 1, 12, 0, seq)),
    description: null,
    targetName: null,
    ...over,
  };
}

function purchase(over: Partial<AreaPurchaseInput> = {}): AreaPurchaseInput {
  seq += 1;
  return {
    id: `p${seq}`,
    totalAmount: "34.00",
    quantity: 4,
    transactionDate: day("2026-10-18"),
    createdAt: new Date(Date.UTC(2026, 9, 18, 12, 0, seq)),
    groupLabel: "Brama",
    ...over,
  };
}

describe("formatLongDateLT", () => {
  it("writes the long Lithuanian date of a @db.Date without shifting the day", () => {
    expect(formatLongDateLT(day("2026-10-25"))).toBe("2026 m. spalio 25 d.");
    expect(formatLongDateLT(day("2026-01-01"))).toBe("2026 m. sausio 1 d.");
  });
});

describe("buildAreaExpenseSummary — the year card", () => {
  it("totals the year by category, largest first", () => {
    const s = buildAreaExpenseSummary({
      area: "HENS",
      year: 2026,
      expenses: [
        expense({ category: "FEED", amount: "52.00" }),
        expense({ category: "MEDICINE", amount: "32.00" }),
        expense({ category: "FEED", amount: "12.50" }),
      ],
      purchases: [],
    });
    expect(s.total).toBe(96.5);
    expect(s.breakdown).toEqual([
      { label: "Pašarai", amount: 64.5 },
      { label: "Vaistai", amount: 32 },
    ]);
  });

  it("adds in cents, so the parts always make the total", () => {
    const s = buildAreaExpenseSummary({
      area: "MEAT",
      year: 2026,
      expenses: [expense({ amount: 0.1 }), expense({ amount: 0.2 })],
      purchases: [],
    });
    expect(s.total).toBe(0.3);
    expect(s.breakdown).toEqual([{ label: "Pašarai", amount: 0.3 }]);
  });

  it("leaves other years out of the card but keeps them in the list", () => {
    const old = expense({ amount: "99.00", expenseDate: day("2025-12-31") });
    const s = buildAreaExpenseSummary({
      area: "MEAT",
      year: 2026,
      expenses: [old, expense({ amount: "5.00", expenseDate: day("2026-01-01") })],
      purchases: [],
    });
    expect(s.total).toBe(5);
    expect(s.rows.map((r) => r.key)).toContain(`expense-${old.id}`);
  });

  it("counts bird purchases in Kiaušiniai as 'Paukščių pirkimai'", () => {
    const s = buildAreaExpenseSummary({
      area: "EGGS",
      year: 2026,
      expenses: [expense({ amount: "1040.00" }), expense({ category: "VITAMINS", amount: "70" })],
      purchases: [purchase({ totalAmount: "100.00" }), purchase({ totalAmount: "36.00" })],
    });
    expect(s.total).toBe(1246);
    expect(s.breakdown).toEqual([
      { label: "Pašarai", amount: 1040 },
      { label: "Paukščių pirkimai", amount: 136 },
      { label: "Vitaminai", amount: 70 },
    ]);
  });

  it.each(["MEAT", "HENS", "INC"] as const)("never counts bird purchases in %s", (area) => {
    const s = buildAreaExpenseSummary({
      area,
      year: 2026,
      expenses: [],
      purchases: [purchase()],
    });
    expect(s.total).toBe(0);
    expect(s.breakdown).toEqual([]);
    expect(s.rows).toEqual([]);
  });

  it("is empty for an area with no records", () => {
    expect(
      buildAreaExpenseSummary({ area: "EGGS", year: 2026, expenses: [], purchases: [] }),
    ).toEqual({ year: 2026, total: 0, breakdown: [], rows: [] });
  });
});

describe("buildAreaExpenseSummary — the list", () => {
  it("lists newest first; same day, expenses before purchases, newest entered first", () => {
    const early = expense({ expenseDate: day("2026-09-29") });
    const sameDayOld = expense({ expenseDate: day("2026-10-18") });
    const sameDayNew = expense({ expenseDate: day("2026-10-18") });
    const buy = purchase({ transactionDate: day("2026-10-18") });
    const latest = expense({ expenseDate: day("2026-10-25") });
    const s = buildAreaExpenseSummary({
      area: "EGGS",
      year: 2026,
      expenses: [early, sameDayOld, latest, sameDayNew],
      purchases: [buy],
    });
    expect(s.rows.map((r) => r.key)).toEqual([
      `expense-${latest.id}`,
      `expense-${sameDayNew.id}`,
      `expense-${sameDayOld.id}`,
      `purchase-${buy.id}`,
      `expense-${early.id}`,
    ]);
  });

  it("shows category and date, the target and description, and opens the expense", () => {
    const withTarget = expense({
      category: "FEED",
      amount: "18.90",
      expenseDate: day("2026-10-25"),
      targetName: "Vištidė A",
      description: "Lesalas dedeklėms, 25 kg",
    });
    const plain = expense({ category: "VITAMINS", amount: "5.5", description: "Vandens priedas" });
    const bare = expense({ category: "OTHER" });
    const s = buildAreaExpenseSummary({
      area: "EGGS",
      year: 2026,
      expenses: [withTarget, plain, bare],
      purchases: [],
    });
    const byKey = Object.fromEntries(s.rows.map((r) => [r.key, r]));

    expect(byKey[`expense-${withTarget.id}`]).toEqual({
      key: `expense-${withTarget.id}`,
      title: "Pašarai · 2026 m. spalio 25 d.",
      detail: "Vištidė A · Lesalas dedeklėms, 25 kg",
      amount: 18.9,
      href: `/expenses/${withTarget.id}/edit`,
    });
    expect(byKey[`expense-${plain.id}`].detail).toBe("Vandens priedas");
    expect(byKey[`expense-${bare.id}`].detail).toBeNull();
  });

  it("shows a bird purchase as 'Paukščių pirkimas' that opens the purchase", () => {
    const buy = purchase({ quantity: 4, groupLabel: "Brama", totalAmount: "34" });
    const unlinked = purchase({ groupLabel: null, quantity: 2 });
    const s = buildAreaExpenseSummary({
      area: "EGGS",
      year: 2026,
      expenses: [],
      purchases: [buy, unlinked],
    });
    const byKey = Object.fromEntries(s.rows.map((r) => [r.key, r]));

    expect(byKey[`purchase-${buy.id}`]).toEqual({
      key: `purchase-${buy.id}`,
      title: "Paukščių pirkimas · 2026 m. spalio 18 d.",
      detail: "4 vnt. · Brama · iš pirkimų",
      amount: 34,
      href: `/birds/purchases/${buy.id}/edit`,
    });
    expect(byKey[`purchase-${unlinked.id}`].detail).toBe("2 vnt. · iš pirkimų");
  });
});
