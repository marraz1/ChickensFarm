import { describe, expect, it } from "vitest";
import { flockByBreed, henStatus, sittingDay, sittingDetail } from "@/lib/area-overview";

describe("sittingDetail", () => {
  it("shows one sitting hen's eggs and day", () => {
    expect(sittingDetail([{ name: "Rita", eggs: 8, day: 6 }])).toBe("8 kiaušiniai · 6-a diena");
    expect(sittingDetail([{ name: "Rita", eggs: 1, day: 1 }])).toBe("1 kiaušinis · 1-a diena");
    expect(sittingDetail([{ name: "Rita", eggs: 12, day: 21 }])).toBe("12 kiaušinių · 21-a diena");
  });

  it("leaves out the eggs when their number is not known", () => {
    expect(sittingDetail([{ name: "Rita", eggs: null, day: 3 }])).toBe("3-a diena");
  });

  it("names several sitting hens, or says nobody sits", () => {
    expect(
      sittingDetail([
        { name: "Rita", eggs: 8, day: 6 },
        { name: "Rudė", eggs: 5, day: 2 },
      ]),
    ).toBe("Rita · Rudė");
    expect(sittingDetail([])).toBe("Šiuo metu niekas neperi");
  });
});

const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe("henStatus", () => {
  it("is Peri while sitting, Ilsisi between broods", () => {
    expect(henStatus({ diedAt: null }, true)).toBe("Peri");
    expect(henStatus({ diedAt: null }, false)).toBe("Ilsisi");
  });

  it("is Nugaišusi for a dead hen, even with an unhatched cycle", () => {
    expect(henStatus({ diedAt: day("2026-10-01") }, true)).toBe("Nugaišusi");
  });
});

describe("sittingDay", () => {
  it("counts the start day as day 1", () => {
    expect(sittingDay(day("2026-10-24"), day("2026-10-24"))).toBe(1);
    expect(sittingDay(day("2026-10-24"), day("2026-10-29"))).toBe(6);
  });

  it("never goes below 1 for a start date set in the future", () => {
    expect(sittingDay(day("2026-11-02"), day("2026-10-29"))).toBe(1);
  });
});

describe("flockByBreed", () => {
  it("merges groups of one breed and lists the largest first", () => {
    expect(
      flockByBreed([
        { breedName: "Sussex", quantity: 6 },
        { breedName: "Brama", quantity: 20 },
        { breedName: "Brama", quantity: 4 },
      ]),
    ).toEqual([
      { name: "Brama", quantity: 24 },
      { name: "Sussex", quantity: 6 },
    ]);
  });

  it("leaves out groups with no birds and breaks ties by name", () => {
    expect(
      flockByBreed([
        { breedName: "Sussex", quantity: 3 },
        { breedName: "Australorp", quantity: 3 },
        { breedName: "Leghorn", quantity: 0 },
      ]),
    ).toEqual([
      { name: "Australorp", quantity: 3 },
      { name: "Sussex", quantity: 3 },
    ]);
  });
});
