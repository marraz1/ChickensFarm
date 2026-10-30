import { describe, expect, it } from "vitest";
import { unitDivisor, unitFigure } from "@/lib/unit-economics";
import type { AreaFinance } from "@/lib/area-finance";

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
    hasRecords: true,
    ...overrides,
  };
}

// The design samples (V2-<Area>-Finance), with lt-LT's non-breaking spaces
// normalised so the expectations read as the screens do.
const text = (...args: Parameters<typeof unitFigure>) =>
  unitFigure(...args).text.replace(/ /g, " ");

describe("unitFigure", () => {
  it("gives Kiaušiniai its profit margin under the result", () => {
    const f = finance({ income: 1742, expenses: 1246, result: 496 });
    expect(unitFigure("eggs", f, 0).placement).toBe("result");
    expect(text("eggs", f, 0)).toBe("Pelno marža 28,5 %");
  });

  it("shows a loss as a negative margin, and — without income", () => {
    expect(text("eggs", finance({ income: 100, expenses: 150, result: -50 }), 0)).toBe(
      "Pelno marža −50,0 %",
    );
    expect(text("eggs", finance({ expenses: 2, result: -2 }), 0)).toBe("Pelno marža —");
  });

  it("divides Perekšlės' expenses among the hens kept, on the Išlaidos card", () => {
    const f = finance({ expenses: 96.5, result: -96.5 });
    expect(unitFigure("hens", f, 2).placement).toBe("expenses");
    expect(text("hens", f, 2)).toBe("48,25 € vienai perekšlei");
    expect(text("hens", f, 0)).toBe("— vienai perekšlei");
  });

  it("gives Perinimas the cost of one hatched chick under the result", () => {
    const f = finance({ income: 120, expenses: 214, result: -94 });
    expect(unitFigure("incubation", f, 31).placement).toBe("result");
    expect(text("incubation", f, 31)).toBe("Vieno išsiritusio jauniklio kaina 6,90 €");
    expect(text("incubation", f, 0)).toBe("Vieno išsiritusio jauniklio kaina —");
  });

  it("divides Mėsa's expenses among the birds now, lost, sold and used at home", () => {
    // 6 in the groups now and lost, 5 sold, 9 eaten: 20 birds, as in the design.
    const f = finance({ income: 100, expenses: 614, result: -514, birdsSold: 5, homeUse: 9 });
    expect(unitFigure("meat", f, 6).placement).toBe("expenses");
    expect(text("meat", f, 6)).toBe("30,70 € vienam paukščiui");
    expect(text("meat", finance({ expenses: 10 }), 0)).toBe("— vienam paukščiui");
  });

  it("rounds a per-unit cost to the cent", () => {
    expect(text("hens", finance({ expenses: 10 }), 3)).toBe("3,33 € vienai perekšlei");
  });

  // #197: the Mėsa Nuostoliai tab divides by the same birds.
  it("spreads Mėsa's expenses over the birds now, lost, sold and used at home", () => {
    const f = finance({ birdsSold: 5, homeUse: 9 });
    expect(unitDivisor("meat", f, 6)).toBe(20);
    expect(unitDivisor("hens", f, 2)).toBe(2);
    expect(unitDivisor("eggs", f, 7)).toBe(0);
  });
});
