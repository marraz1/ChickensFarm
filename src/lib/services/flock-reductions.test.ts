import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Story #157: meat/food use must never read as mortality ----------------
//
// The reason BirdConsumption exists as its own table is reporting: before it,
// the only way to record a bird slaughtered for the table was a Loss with
// reason OTHER, which getLossesByReasonReport counts as mortality. This suite
// is the guard on that. It runs the real report functions against the
// in-memory fake Prisma client (fake-prisma.ts) — CI has no reachable
// database, see the note at the top of multi-tenant-isolation.test.ts.

vi.mock("@/lib/prisma", async () => {
  const { fakePrisma } = await import("./fake-prisma");
  return { prisma: fakePrisma };
});

import { fakePrisma, resetFakePrisma } from "./fake-prisma";
import { createBirdConsumption } from "@/lib/services/bird-consumptions";
import { getLossesByReasonReport } from "@/lib/services/losses";
import { getFlockReductionsReport } from "@/lib/services/reports";

const FARM_ID = "farm-1";
const USER_ID = "user-1";
const RANGE = { from: new Date("2025-03-01"), to: new Date("2025-03-31") };

beforeEach(async () => {
  resetFakePrisma();
  await fakePrisma.farm.create({
    data: { id: FARM_ID, ownerId: USER_ID, name: "Farm", deletedAt: null },
  });
  await fakePrisma.breed.create({
    data: { id: "breed-1", farmId: FARM_ID, name: "Vištos", birdType: "HEN" },
  });
  await fakePrisma.birdGroup.create({
    data: {
      id: "group-1",
      farmId: FARM_ID,
      breedId: "breed-1",
      name: null,
      sex: "UNKNOWN",
      category: "LAYER",
      quantity: 100,
      birthOrAcquiredDate: new Date("2025-01-01"),
    },
  });
});

async function seedLoss(id: string, reasonType: string, quantity: number, date: string) {
  await fakePrisma.loss.create({
    data: {
      id,
      farmId: FARM_ID,
      birdGroupId: "group-1",
      lossDate: new Date(date),
      quantity,
      reasonType,
    },
  });
}

async function seedSale(id: string, quantity: number, date: string) {
  await fakePrisma.birdTransaction.create({
    data: {
      id,
      farmId: FARM_ID,
      birdGroupId: "group-1",
      type: "SALE",
      transactionDate: new Date(date),
      quantity,
      unitPrice: 5,
      totalAmount: quantity * 5,
    },
  });
}

describe("getLossesByReasonReport", () => {
  it("does not count meat/food use in any reason bucket", async () => {
    await seedLoss("loss-1", "DISEASE", 2, "2025-03-05");
    await seedLoss("loss-2", "OTHER", 1, "2025-03-06");

    const before = await getLossesByReasonReport(FARM_ID, RANGE);
    expect(before).toEqual({ DISEASE: 2, PREDATOR: 0, OTHER: 1 });

    await createBirdConsumption(FARM_ID, USER_ID, {
      consumptionDate: "2025-03-07",
      birdGroupId: "group-1",
      quantity: 9,
    });

    // The whole point of the story: the "Kita" bucket must not move.
    expect(await getLossesByReasonReport(FARM_ID, RANGE)).toEqual(before);
  });

  it("reports nothing at all when the only record in the period is meat/food use", async () => {
    await createBirdConsumption(FARM_ID, USER_ID, {
      consumptionDate: "2025-03-07",
      birdGroupId: "group-1",
      quantity: 9,
    });

    expect(await getLossesByReasonReport(FARM_ID, RANGE)).toEqual({
      DISEASE: 0,
      PREDATOR: 0,
      OTHER: 0,
    });
  });
});

describe("getFlockReductionsReport", () => {
  it("shows deaths, sales and meat/food use as three separate figures", async () => {
    await seedLoss("loss-1", "PREDATOR", 3, "2025-03-04");
    await seedLoss("loss-2", "DISEASE", 2, "2025-03-05");
    await seedSale("sale-1", 7, "2025-03-06");
    await createBirdConsumption(FARM_ID, USER_ID, {
      consumptionDate: "2025-03-07",
      birdGroupId: "group-1",
      quantity: 4,
    });

    const report = await getFlockReductionsReport(FARM_ID, RANGE);

    expect(report).toMatchObject({
      losses: { DISEASE: 2, PREDATOR: 3, OTHER: 0 },
      lossesTotal: 5,
      sold: 7,
      meatUse: 4,
      total: 16,
    });
  });

  it("keeps meat/food use out of lossesTotal", async () => {
    await createBirdConsumption(FARM_ID, USER_ID, {
      consumptionDate: "2025-03-07",
      birdGroupId: "group-1",
      quantity: 4,
    });

    const report = await getFlockReductionsReport(FARM_ID, RANGE);
    expect(report.lossesTotal).toBe(0);
    expect(report.meatUse).toBe(4);
    expect(report.total).toBe(4);
  });

  it("excludes records dated outside the range", async () => {
    await seedLoss("loss-1", "DISEASE", 2, "2025-02-20");
    await seedSale("sale-1", 7, "2025-04-02");
    await createBirdConsumption(FARM_ID, USER_ID, {
      consumptionDate: "2025-02-28",
      birdGroupId: "group-1",
      quantity: 4,
    });
    await createBirdConsumption(FARM_ID, USER_ID, {
      consumptionDate: "2025-03-15",
      birdGroupId: "group-1",
      quantity: 6,
    });

    const report = await getFlockReductionsReport(FARM_ID, RANGE);
    expect(report).toMatchObject({ lossesTotal: 0, sold: 0, meatUse: 6, total: 6 });
  });

  it("reports zeros for a period with no records", async () => {
    const report = await getFlockReductionsReport(FARM_ID, RANGE);
    expect(report).toEqual({
      losses: { DISEASE: 0, PREDATOR: 0, OTHER: 0 },
      lossesTotal: 0,
      sold: 0,
      meatUse: 0,
      total: 0,
    });
  });

  it("does not count another farm's reductions", async () => {
    await fakePrisma.farm.create({
      data: { id: "farm-2", ownerId: "user-2", name: "Other", deletedAt: null },
    });
    await fakePrisma.birdConsumption.create({
      data: {
        id: "other-consumption",
        farmId: "farm-2",
        birdGroupId: "group-x",
        consumptionDate: new Date("2025-03-10"),
        quantity: 50,
      },
    });
    await fakePrisma.loss.create({
      data: {
        id: "other-loss",
        farmId: "farm-2",
        birdGroupId: "group-x",
        lossDate: new Date("2025-03-10"),
        quantity: 50,
        reasonType: "DISEASE",
      },
    });

    const report = await getFlockReductionsReport(FARM_ID, RANGE);
    expect(report).toMatchObject({ lossesTotal: 0, sold: 0, meatUse: 0, total: 0 });
  });
});
