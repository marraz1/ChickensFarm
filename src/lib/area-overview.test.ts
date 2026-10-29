import { describe, expect, it } from "vitest";
import { flockByBreed } from "@/lib/area-overview";

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
