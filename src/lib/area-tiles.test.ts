import { describe, expect, it } from "vitest";
import { areaTiles } from "@/lib/area-tiles";
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

const month = (year: number, m: number, result: number): AreaFinanceMonth => ({
  year,
  month: m,
  income: Math.max(result, 0),
  expenses: Math.max(-result, 0),
  result,
});

const NO_LOSSES = { EGGS: 0, HENS: 0, INC: 0, MEAT: 0 };

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

const tileOf = (tiles: ReturnType<typeof areaTiles>, area: FarmArea) =>
  tiles.find((t) => t.area === area)!;

describe("areaTiles", () => {
  it("lists the four areas then Bendros išlaidos, in the donut's colours", () => {
    const tiles = areaTiles(farm(), NO_LOSSES);
    expect(tiles.map((t) => [t.name, t.color])).toEqual([
      ["Kiaušiniai ir prekyba", "#2a78d6"],
      ["Perekšlės", "#eb6834"],
      ["Perinimas", "#1baf7a"],
      ["Mėsiniai paukščiai", "#eda100"],
      ["Bendros išlaidos", "#e87ba4"],
    ]);
  });

  it("carries each area's result, income and expenses", () => {
    const tiles = areaTiles(
      farm({ EGGS: finance({ income: 1742, expenses: 1246, result: 496 }) }),
      NO_LOSSES,
    );
    expect(tileOf(tiles, "EGGS")).toMatchObject({ income: 1742, expenses: 1246, result: 496 });
  });

  it("gives Bendros no losses and no links, but a note of what it paid for", () => {
    const shared = tileOf(
      areaTiles(
        farm({
          SHARED: finance({
            expenses: 140,
            result: -140,
            byCategory: [
              { label: "Elektra", amount: 85, share: 0.6 },
              { label: "Tvoros ir remontas", amount: 55, share: 0.4 },
            ],
          }),
        }),
        NO_LOSSES,
      ),
      "SHARED",
    );
    expect(shared).toMatchObject({ losses: null, links: null });
    expect(shared.sharedNote).toBe("Elektra, tvoros ir remontas");
    expect(tileOf(areaTiles(farm(), NO_LOSSES), "SHARED").sharedNote).toBe("Išlaidų nėra");
  });

  it("links each area to its overview and Finansai tab", () => {
    const tiles = areaTiles(farm(), NO_LOSSES);
    expect(tiles.slice(0, 4).map((t) => t.links)).toEqual([
      { overview: "/areas/eggs", finance: "/areas/eggs/finance" },
      { overview: "/areas/hens", finance: "/areas/hens/finance" },
      { overview: "/areas/incubation", finance: "/areas/incubation/finance" },
      { overview: "/areas/meat", finance: "/areas/meat/finance" },
    ]);
    expect(tiles.slice(0, 4).every((t) => t.sharedNote === null)).toBe(true);
  });

  it("shows the three biggest expense categories at most", () => {
    const byCategory = ["Pašarai", "Paukščių pirkimai", "Vitaminai", "Kita"].map((label, i) => ({
      label,
      amount: 40 - i * 10,
      share: 0.25,
    }));
    const eggs = tileOf(areaTiles(farm({ EGGS: finance({ byCategory }) }), NO_LOSSES), "EGGS");
    expect(eggs.topCategories).toEqual([
      { label: "Pašarai", amount: 40 },
      { label: "Paukščių pirkimai", amount: 30 },
      { label: "Vitaminai", amount: 20 },
    ]);
    expect(tileOf(areaTiles(farm(), NO_LOSSES), "HENS").topCategories).toEqual([]);
  });

  it("counts losses in each area's own words", () => {
    const tiles = areaTiles(farm(), { EGGS: 1, HENS: 0, INC: 2, MEAT: 12 });
    expect(tiles.map((t) => t.losses)).toEqual([
      "1 paukštis",
      "0 paukščių",
      "2 jaunikliai",
      "12 paukščių",
      null,
    ]);
  });

  it("shows the period's newest three months, with the year when they span two", () => {
    const months = [
      month(2026, 9, 48.4),
      month(2026, 8, -40),
      month(2026, 7, 90),
      month(2026, 6, 1),
    ];
    const eggs = tileOf(areaTiles(farm({ EGGS: finance({ months }) }), NO_LOSSES), "EGGS");
    expect(eggs.months).toEqual([
      { key: "2026-9", label: "Spalis", result: 48.4 },
      { key: "2026-8", label: "Rugsėjis", result: -40 },
      { key: "2026-7", label: "Rugpjūtis", result: 90 },
    ]);

    const acrossYears = tileOf(
      areaTiles(
        farm({
          MEAT: finance({ months: [month(2026, 0, 5), month(2025, 11, -2)], spansYears: true }),
        }),
        NO_LOSSES,
      ),
      "MEAT",
    );
    expect(acrossYears.months.map((m) => m.label)).toEqual(["Sausis 2026", "Gruodis 2025"]);

    // A range spanning years whose last three months share one: no year.
    const lateInRange = tileOf(
      areaTiles(
        farm({
          INC: finance({
            months: [month(2026, 9, 1), month(2026, 8, 1), month(2026, 7, 1), month(2025, 10, 1)],
            spansYears: true,
          }),
        }),
        NO_LOSSES,
      ),
      "INC",
    );
    expect(lateInRange.months.map((m) => m.label)).toEqual(["Spalis", "Rugsėjis", "Rugpjūtis"]);
  });
});
