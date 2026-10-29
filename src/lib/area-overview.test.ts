import { describe, expect, it } from "vitest";
import { flockByBreed, henStatus, sittingDay } from "@/lib/area-overview";

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
