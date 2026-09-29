import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Story #157: birds used for meat/food ---------------------------------
//
// These records are the one flock reduction that is neither a death nor a sale,
// so what matters is that they move the group's head count exactly like a loss
// does while staying a distinct kind of event. Both halves are checked here:
// the quantity arithmetic across create/update/delete, and the BirdGroupEvent
// each write leaves behind.
//
// Runs against the in-memory fake Prisma client (fake-prisma.ts) for the same
// reason multi-tenant-isolation.test.ts does — CI has no reachable database.
// One consequence to keep in mind: the fake's `$transaction` just invokes the
// callback, so it cannot roll back. Where a real Postgres transaction would
// undo a partial write, the assertions below check the caller-visible effect
// (the group's quantity, the audit trail) rather than the absence of the row.

vi.mock("@/lib/prisma", async () => {
  const { fakePrisma } = await import("./fake-prisma");
  return { prisma: fakePrisma };
});

import { fakePrisma, resetFakePrisma } from "./fake-prisma";
import { ValidationError } from "@/lib/errors";
import { NegativeQuantityError } from "@/lib/services/bird-groups";
import {
  createBirdConsumption,
  deleteBirdConsumption,
  getBirdConsumption,
  getBirdConsumptionTotal,
  listBirdConsumptions,
  updateBirdConsumption,
} from "@/lib/services/bird-consumptions";
import { deleteBirdGroup, GroupHasReferencesError } from "@/lib/services/bird-groups";

const FARM_ID = "farm-1";
const USER_ID = "user-1";

/** A bird group with a head count, plus the INITIAL event createBirdGroup writes. */
async function seedGroup(
  id: string,
  quantity: number,
  overrides: { category?: string; birdType?: string; name?: string | null } = {},
) {
  await fakePrisma.breed.create({
    data: {
      id: `breed-${id}`,
      farmId: FARM_ID,
      name: `Breed ${id}`,
      birdType: overrides.birdType ?? "HEN",
    },
  });
  await fakePrisma.birdGroup.create({
    data: {
      id,
      farmId: FARM_ID,
      breedId: `breed-${id}`,
      name: overrides.name ?? null,
      sex: "UNKNOWN",
      category: overrides.category ?? "OTHER",
      quantity,
      birthOrAcquiredDate: new Date("2025-01-01"),
    },
  });
}

async function groupQuantity(id: string): Promise<number> {
  const group = await fakePrisma.birdGroup.findFirst({ where: { id } });
  return group!.quantity as number;
}

async function eventsFor(id: string) {
  return fakePrisma.birdGroupEvent.findMany({ where: { birdGroupId: id } });
}

const input = { consumptionDate: "2025-03-10", birdGroupId: "group-1", quantity: 3 };

beforeEach(async () => {
  resetFakePrisma();
  await fakePrisma.farm.create({
    data: { id: FARM_ID, ownerId: USER_ID, name: "Farm", deletedAt: null },
  });
});

describe("createBirdConsumption", () => {
  beforeEach(async () => {
    await seedGroup("group-1", 10);
  });

  it("stores the date, group, quantity and note", async () => {
    const created = await createBirdConsumption(FARM_ID, USER_ID, {
      ...input,
      note: "Kalėdų vakarienei",
    });

    expect(created).toMatchObject({
      farmId: FARM_ID,
      birdGroupId: "group-1",
      quantity: 3,
      note: "Kalėdų vakarienei",
    });
    expect((created.consumptionDate as Date).toISOString().slice(0, 10)).toBe("2025-03-10");
  });

  it("normalises an omitted note to null rather than storing an empty string", async () => {
    const created = await createBirdConsumption(FARM_ID, USER_ID, { ...input, note: "" });
    expect(created.note).toBeNull();
  });

  it("decreases the bird group's quantity by the recorded amount", async () => {
    await createBirdConsumption(FARM_ID, USER_ID, input);
    expect(await groupQuantity("group-1")).toBe(7);
  });

  it("records a MEAT_USE event, distinguishable from LOSS and SALE", async () => {
    const created = await createBirdConsumption(FARM_ID, USER_ID, input);

    const events = await eventsFor("group-1");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "MEAT_USE",
      quantityDelta: -3,
      quantityBefore: 10,
      quantityAfter: 7,
      sourceType: "birdConsumption",
      sourceId: created.id,
      createdById: USER_ID,
    });
  });

  it("rejects a quantity larger than the group holds and leaves the count alone", async () => {
    await expect(
      createBirdConsumption(FARM_ID, USER_ID, { ...input, quantity: 11 }),
    ).rejects.toThrow(NegativeQuantityError);
    expect(await groupQuantity("group-1")).toBe(10);
  });

  it("allows taking the whole group", async () => {
    await createBirdConsumption(FARM_ID, USER_ID, { ...input, quantity: 10 });
    expect(await groupQuantity("group-1")).toBe(0);
  });

  it("rejects a group that does not exist", async () => {
    await expect(
      createBirdConsumption(FARM_ID, USER_ID, { ...input, birdGroupId: "nope" }),
    ).rejects.toThrow(ValidationError);
  });

  // AC: available for any BirdType/BirdCategory, not just non-laying ones.
  it.each([
    ["LAYER", "HEN"],
    ["ROOSTER", "HEN"],
    ["CHICK", "DUCK"],
    ["OTHER", "GOOSE"],
    ["PULLET", "TURKEY"],
  ])("works for a %s group of type %s", async (category, birdType) => {
    await seedGroup("group-2", 8, { category, birdType });
    await createBirdConsumption(FARM_ID, USER_ID, {
      ...input,
      birdGroupId: "group-2",
      quantity: 2,
    });
    expect(await groupQuantity("group-2")).toBe(6);
  });
});

describe("updateBirdConsumption", () => {
  beforeEach(async () => {
    await seedGroup("group-1", 10);
    await seedGroup("group-2", 4);
  });

  it("takes only the difference when the quantity grows", async () => {
    const created = await createBirdConsumption(FARM_ID, USER_ID, input); // 10 -> 7
    await updateBirdConsumption(FARM_ID, created.id, USER_ID, { ...input, quantity: 5 });

    expect(await groupQuantity("group-1")).toBe(5);
    const events = await eventsFor("group-1");
    expect(events[1]).toMatchObject({ eventType: "MEAT_USE", quantityDelta: -2 });
  });

  it("gives birds back as a correction when the quantity shrinks", async () => {
    const created = await createBirdConsumption(FARM_ID, USER_ID, input); // 10 -> 7
    await updateBirdConsumption(FARM_ID, created.id, USER_ID, { ...input, quantity: 1 });

    expect(await groupQuantity("group-1")).toBe(9);
    const events = await eventsFor("group-1");
    expect(events[1]).toMatchObject({ eventType: "MANUAL_ADJUSTMENT", quantityDelta: 2 });
  });

  it("writes no quantity event when only the date or note changed", async () => {
    const created = await createBirdConsumption(FARM_ID, USER_ID, input);
    await updateBirdConsumption(FARM_ID, created.id, USER_ID, {
      ...input,
      consumptionDate: "2025-04-01",
      note: "pataisyta",
    });

    expect(await groupQuantity("group-1")).toBe(7);
    expect(await eventsFor("group-1")).toHaveLength(1);
    expect(await getBirdConsumption(FARM_ID, created.id)).toMatchObject({ note: "pataisyta" });
  });

  it("restores the old group and debits the new one when the group changes", async () => {
    const created = await createBirdConsumption(FARM_ID, USER_ID, input); // group-1: 10 -> 7
    await updateBirdConsumption(FARM_ID, created.id, USER_ID, {
      ...input,
      birdGroupId: "group-2",
      quantity: 2,
    });

    expect(await groupQuantity("group-1")).toBe(10);
    expect(await groupQuantity("group-2")).toBe(2);
    expect((await eventsFor("group-2"))[0]).toMatchObject({
      eventType: "MEAT_USE",
      quantityDelta: -2,
    });
    expect(await getBirdConsumption(FARM_ID, created.id)).toMatchObject({
      birdGroupId: "group-2",
      quantity: 2,
    });
  });

  it("rejects growing the quantity past what the group holds", async () => {
    const created = await createBirdConsumption(FARM_ID, USER_ID, input);
    await expect(
      updateBirdConsumption(FARM_ID, created.id, USER_ID, { ...input, quantity: 11 }),
    ).rejects.toThrow(NegativeQuantityError);
    expect(await groupQuantity("group-1")).toBe(7);
  });

  it("rejects moving the record onto a group that does not exist", async () => {
    const created = await createBirdConsumption(FARM_ID, USER_ID, input);
    await expect(
      updateBirdConsumption(FARM_ID, created.id, USER_ID, { ...input, birdGroupId: "nope" }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects an unknown record", async () => {
    await expect(updateBirdConsumption(FARM_ID, "nope", USER_ID, input)).rejects.toThrow(
      ValidationError,
    );
  });
});

describe("deleteBirdConsumption", () => {
  beforeEach(async () => {
    await seedGroup("group-1", 10);
  });

  it("removes the record and gives the birds back", async () => {
    const created = await createBirdConsumption(FARM_ID, USER_ID, input);
    await deleteBirdConsumption(FARM_ID, created.id, USER_ID);

    expect(await getBirdConsumption(FARM_ID, created.id)).toBeNull();
    expect(await groupQuantity("group-1")).toBe(10);
    expect((await eventsFor("group-1"))[1]).toMatchObject({
      eventType: "MANUAL_ADJUSTMENT",
      quantityDelta: 3,
    });
  });

  it("rejects an unknown record", async () => {
    await expect(deleteBirdConsumption(FARM_ID, "nope", USER_ID)).rejects.toThrow(ValidationError);
  });
});

describe("listBirdConsumptions", () => {
  it("returns only this farm's records", async () => {
    await fakePrisma.farm.create({
      data: { id: "farm-2", ownerId: "user-2", name: "Other", deletedAt: null },
    });
    await seedGroup("group-1", 10);
    await createBirdConsumption(FARM_ID, USER_ID, input);
    await fakePrisma.birdConsumption.create({
      data: {
        id: "other",
        farmId: "farm-2",
        birdGroupId: "group-x",
        consumptionDate: new Date("2025-03-10"),
        quantity: 1,
      },
    });

    const rows = await listBirdConsumptions(FARM_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ farmId: FARM_ID });
  });
});

describe("getBirdConsumptionTotal", () => {
  beforeEach(async () => {
    await seedGroup("group-1", 50);
    await createBirdConsumption(FARM_ID, USER_ID, { ...input, consumptionDate: "2025-03-10" });
    await createBirdConsumption(FARM_ID, USER_ID, {
      ...input,
      consumptionDate: "2025-05-20",
      quantity: 4,
    });
  });

  it("sums every record when no range is given", async () => {
    expect(await getBirdConsumptionTotal(FARM_ID)).toBe(7);
  });

  it("counts only records inside the range, both bounds included", async () => {
    expect(
      await getBirdConsumptionTotal(FARM_ID, {
        from: new Date("2025-03-10"),
        to: new Date("2025-03-10"),
      }),
    ).toBe(3);
  });

  it("is 0 for a farm with no records", async () => {
    expect(await getBirdConsumptionTotal("farm-empty")).toBe(0);
  });
});

describe("deleteBirdGroup with meat/food-use records", () => {
  // The link is NOT NULL with onDelete: Restrict, so without the count in
  // deleteBirdGroup this would surface as an opaque FK error from Postgres.
  it("refuses to delete a group that has been used for meat/food", async () => {
    await seedGroup("group-1", 10);
    await createBirdConsumption(FARM_ID, USER_ID, input);

    await expect(deleteBirdGroup(FARM_ID, "group-1")).rejects.toThrow(GroupHasReferencesError);
    expect(await fakePrisma.birdGroup.findFirst({ where: { id: "group-1" } })).not.toBeNull();
  });

  it("still deletes a group with no records against it", async () => {
    await seedGroup("group-1", 10);
    await deleteBirdGroup(FARM_ID, "group-1");
    expect(await fakePrisma.birdGroup.findFirst({ where: { id: "group-1" } })).toBeNull();
  });
});
