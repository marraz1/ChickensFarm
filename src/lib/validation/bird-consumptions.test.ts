import { describe, expect, it } from "vitest";
import { createBirdConsumptionSchema } from "./bird-consumptions";

const valid = {
  consumptionDate: "2025-03-10",
  birdGroupId: "group-1",
  quantity: 3,
  note: "Kalėdų vakarienei",
};

describe("createBirdConsumptionSchema", () => {
  it("accepts a full record", () => {
    expect(createBirdConsumptionSchema.parse(valid)).toEqual(valid);
  });

  it("accepts an omitted note", () => {
    expect(
      createBirdConsumptionSchema.safeParse({
        consumptionDate: valid.consumptionDate,
        birdGroupId: valid.birdGroupId,
        quantity: valid.quantity,
      }).success,
    ).toBe(true);
  });

  it("accepts an empty note, which the service stores as null", () => {
    expect(createBirdConsumptionSchema.safeParse({ ...valid, note: "" }).success).toBe(true);
  });

  it("trims the note", () => {
    expect(createBirdConsumptionSchema.parse({ ...valid, note: "  ryte  " }).note).toBe("ryte");
  });

  it("rejects a note longer than 500 characters", () => {
    expect(createBirdConsumptionSchema.safeParse({ ...valid, note: "x".repeat(501) }).success).toBe(
      false,
    );
  });

  it("requires a date", () => {
    expect(createBirdConsumptionSchema.safeParse({ ...valid, consumptionDate: "" }).success).toBe(
      false,
    );
  });

  // Unlike a loss or a bird sale, the group is mandatory: the record's only
  // effect is to take birds out of one.
  it("requires a bird group", () => {
    const result = createBirdConsumptionSchema.safeParse({ ...valid, birdGroupId: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Pasirinkite paukščių grupę");
  });

  it.each([0, -1, 2.5])("rejects a quantity of %s", (quantity) => {
    expect(createBirdConsumptionSchema.safeParse({ ...valid, quantity }).success).toBe(false);
  });

  it("reports the quantity message the form shows inline", () => {
    const result = createBirdConsumptionSchema.safeParse({ ...valid, quantity: 0 });
    expect(result.error?.issues[0]?.message).toBe("Kiekis turi būti bent 1");
  });
});
