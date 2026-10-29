import { describe, expect, it } from "vitest";
import { AREA_CHART, areaSplit, donutSegments, splitTextAlternative } from "@/lib/area-split";
import { formatShareLT } from "@/lib/format";
import type { FarmArea } from "@/generated/prisma/client";

type Money = { income: number; expenses: number };
const areas = (values: Partial<Record<FarmArea, Partial<Money>>>) =>
  Object.fromEntries(
    (["EGGS", "HENS", "INC", "MEAT", "SHARED"] as const).map((a) => [
      a,
      { income: 0, expenses: 0, ...values[a] },
    ]),
  ) as Record<FarmArea, Money>;

// The design's sample year (V2-Overview).
const SAMPLE = areas({
  EGGS: { income: 1742, expenses: 1246 },
  HENS: { expenses: 96.5 },
  INC: { income: 120, expenses: 214 },
  MEAT: { income: 100, expenses: 614 },
  SHARED: { expenses: 140 },
});

describe("areaSplit", () => {
  it("lists every area in order with its share of the spending", () => {
    const split = areaSplit(SAMPLE, "expenses");
    expect(split.total).toBe(2310.5);
    expect(split.parts.map((p) => p.short)).toEqual([
      "Kiaušiniai",
      "Perekšlės",
      "Perinimas",
      "Mėsa",
      "Bendros",
    ]);
    expect(formatShareLT(split.parts[0].share)).toBe(formatShareLT(0.539));
    expect(split.parts.reduce((sum, p) => sum + p.share, 0)).toBeCloseTo(1, 10);
  });

  it("keeps each area's colour in both views", () => {
    const expenses = areaSplit(SAMPLE, "expenses").parts.map((p) => [p.area, p.color]);
    const income = areaSplit(SAMPLE, "income").parts.map((p) => [p.area, p.color]);
    expect(income).toEqual(expenses);
    expect(AREA_CHART).toMatchObject({
      EGGS: { color: "#2a78d6" },
      HENS: { color: "#eb6834" },
      INC: { color: "#1baf7a" },
      MEAT: { color: "#eda100" },
      SHARED: { color: "#e87ba4" },
    });
  });

  it("shows income with Perekšlės and Bendros at nothing", () => {
    const split = areaSplit(SAMPLE, "income");
    expect(split.total).toBe(1962);
    expect(split.parts.find((p) => p.area === "HENS")).toMatchObject({ amount: 0, share: 0 });
    expect(split.parts.find((p) => p.area === "SHARED")).toMatchObject({ amount: 0, share: 0 });
  });

  it("sums the total in cents", () => {
    expect(
      areaSplit(areas({ EGGS: { expenses: 0.1 }, MEAT: { expenses: 0.2 } }), "expenses").total,
    ).toBe(0.3);
  });

  it("has no shares and no slices for a period with no money", () => {
    const split = areaSplit(areas({}), "expenses");
    expect(split.total).toBe(0);
    expect(split.parts.every((p) => p.share === 0)).toBe(true);
    expect(donutSegments(split.parts, 52)).toEqual([]);
  });
});

describe("donutSegments", () => {
  it("lays the areas with money end to end, skipping the empty ones", () => {
    const parts = areaSplit(
      areas({ EGGS: { expenses: 3 }, SHARED: { expenses: 1 } }),
      "expenses",
    ).parts;
    const circumference = 2 * Math.PI * 52;
    const segments = donutSegments(parts, 52);

    expect(segments.map((s) => s.area)).toEqual(["EGGS", "SHARED"]);
    expect(segments[0]).toMatchObject({
      color: "#2a78d6",
      offset: "0",
      dash: `${0.75 * circumference - 2} ${circumference}`,
    });
    // Bendros starts where Kiaušiniai's arc ends.
    expect(Number(segments[1].offset)).toBeCloseTo(-0.75 * circumference, 10);
  });

  it("still draws a sliver for a tiny share", () => {
    const parts = areaSplit(
      areas({ EGGS: { expenses: 10_000 }, HENS: { expenses: 0.01 } }),
      "expenses",
    ).parts;
    expect(donutSegments(parts, 52)[1].dash.startsWith("0.5 ")).toBe(true);
  });
});

describe("splitTextAlternative", () => {
  it("names every area with its amount and share", () => {
    const text = splitTextAlternative(
      areaSplit(areas({ MEAT: { expenses: 3 }, SHARED: { expenses: 1 } }), "expenses"),
      "expenses",
    );
    expect(text.startsWith("Išlaidos pagal sritį: Kiaušiniai")).toBe(true);
    for (const short of ["Kiaušiniai", "Perekšlės", "Perinimas", "Mėsa", "Bendros"]) {
      expect(text).toContain(short);
    }
    expect(text).toContain(`Mėsa 3,00 € (${formatShareLT(0.75)})`);
  });

  it("says Pajamos for the income view", () => {
    expect(splitTextAlternative(areaSplit(areas({}), "income"), "income")).toMatch(
      /^Pajamos pagal sritį: /,
    );
  });
});
