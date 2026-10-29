import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Story #187: the Kiaušiniai area overview ---------------------------------
//
// Runs the real service against the in-memory fake Prisma client
// (fake-prisma.ts) — CI has no reachable database, see the note at the top of
// multi-tenant-isolation.test.ts. The fake applies no column defaults, so
// seeded rows spell out `area`.

vi.mock("@/lib/prisma", async () => {
  const { fakePrisma } = await import("./fake-prisma");
  return { prisma: fakePrisma };
});

import { fakePrisma, resetFakePrisma } from "./fake-prisma";
import { getEggsOverview } from "@/lib/services/area-overview";
import { getAreaFinance } from "@/lib/services/area-finance";
import { resolveFinancePeriod } from "@/lib/finance-period";

const FARM_ID = "farm-1";
const day = (s: string) => new Date(`${s}T00:00:00Z`);
// 01:30 on November 1st in Vilnius, still October 31st in UTC.
const NOW = new Date("2026-10-31T23:30:00Z");

async function seedGroup(id: string, breedId: string, area: string, quantity: number) {
  await fakePrisma.birdGroup.create({
    data: {
      id,
      farmId: FARM_ID,
      breedId,
      name: null,
      sex: "UNKNOWN",
      category: "LAYER",
      area,
      quantity,
      birthOrAcquiredDate: day("2026-01-01"),
    },
  });
}

async function collect(date: string, quantity: number) {
  await fakePrisma.eggCollection.create({
    data: { farmId: FARM_ID, birdGroupId: null, collectionDate: day(date), quantity },
  });
}

beforeEach(async () => {
  resetFakePrisma();
  await fakePrisma.farm.create({
    data: { id: FARM_ID, ownerId: "user-1", name: "Farm", deletedAt: null },
  });
  for (const [id, name] of [
    ["brama", "Brama"],
    ["sussex", "Sussex"],
  ]) {
    await fakePrisma.breed.create({ data: { id, farmId: FARM_ID, name, birdType: "HEN" } });
  }
});

describe("getEggsOverview", () => {
  it("counts egg stock as collected minus sold minus eaten", async () => {
    await collect("2025-12-30", 50);
    await collect("2026-10-15", 30);
    await fakePrisma.eggSale.create({
      data: {
        farmId: FARM_ID,
        saleDate: day("2026-10-16"),
        quantity: 20,
        unitPrice: 0.3,
        totalAmount: 6,
        buyer: null,
      },
    });
    await fakePrisma.eggConsumption.create({
      data: { farmId: FARM_ID, consumptionDate: day("2026-11-01"), quantity: 4, note: null },
    });

    const o = await getEggsOverview(FARM_ID, NOW);
    expect(o.eggStock).toBe(56);
    expect(o.collectedThisYear).toBe(30);
  });

  it("reads this month in Vilnius", async () => {
    await collect("2026-10-31", 7);
    await collect("2026-11-01", 5);
    await fakePrisma.eggConsumption.create({
      data: { farmId: FARM_ID, consumptionDate: day("2026-11-01"), quantity: 2, note: null },
    });

    const o = await getEggsOverview(FARM_ID, NOW);
    expect(o.collectedThisMonth).toBe(5);
    expect(o.stats).toMatchObject({ collected: 5, eggsConsumed: 2 });
  });

  it("counts only Kiaušiniai groups in the flock, split by breed", async () => {
    await seedGroup("g1", "brama", "EGGS", 20);
    await seedGroup("g2", "sussex", "EGGS", 6);
    await seedGroup("g3", "brama", "EGGS", 4);
    await seedGroup("g4", "brama", "MEAT", 50);
    await seedGroup("g5", "sussex", "INC", 12);
    // Sold out: still listed, but holds no birds, so it is not counted.
    await seedGroup("g6", "sussex", "EGGS", 0);

    const o = await getEggsOverview(FARM_ID, NOW);
    expect(o.flock).toEqual({
      total: 30,
      groups: 3,
      byBreed: [
        { name: "Brama", quantity: 24 },
        { name: "Sussex", quantity: 6 },
      ],
    });
    expect(o.stats.groups).toBe(3);
  });

  it("takes its money from the Kiaušiniai finances, the balance for the year", async () => {
    await fakePrisma.eggSale.create({
      data: {
        farmId: FARM_ID,
        saleDate: day("2026-11-01"),
        quantity: 10,
        unitPrice: 0.5,
        totalAmount: 5,
        buyer: null,
      },
    });
    await fakePrisma.birdTransaction.create({
      data: {
        farmId: FARM_ID,
        birdGroupId: null,
        area: "EGGS",
        type: "PURCHASE",
        transactionDate: day("2026-03-01"),
        quantity: 2,
        unitPrice: 8,
        totalAmount: 16,
      },
    });

    const o = await getEggsOverview(FARM_ID, NOW);
    const month = await getAreaFinance(
      FARM_ID,
      "EGGS",
      resolveFinancePeriod({ period: "month" }, NOW),
    );
    expect(o.stats).toMatchObject({
      eggSales: month.eggIncome,
      purchases: month.purchases,
      birdSales: month.birdIncome,
    });
    expect(o.stats).toMatchObject({ eggSales: 5, purchases: 0 });
    expect(o.balance).toMatchObject({ income: 5, expenses: 16, result: -11 });
    expect(o.year).toBe(2026);
  });
});
