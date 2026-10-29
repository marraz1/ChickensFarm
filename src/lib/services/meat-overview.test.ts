import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Story #190: the Mėsa overview -------------------------------------------
//
// Runs the real service against the in-memory fake Prisma client
// (fake-prisma.ts) — CI has no reachable database, see the note at the top of
// multi-tenant-isolation.test.ts. The fake applies no column defaults, so
// seeded rows spell out the nullable columns.

vi.mock("@/lib/prisma", async () => {
  const { fakePrisma } = await import("./fake-prisma");
  return { prisma: fakePrisma };
});

import { fakePrisma, resetFakePrisma } from "./fake-prisma";
import { getMeatOverview } from "@/lib/services/area-overview";
import { getAreaFinance } from "@/lib/services/area-finance";
import { listBirdTransactions } from "@/lib/services/bird-transactions";
import { resolveFinancePeriod } from "@/lib/finance-period";

const FARM_ID = "farm-1";
const day = (s: string) => new Date(`${s}T00:00:00Z`);
// 09:00 on October 29th in Vilnius.
const NOW = new Date("2026-10-29T07:00:00Z");

async function seedGroup(
  id: string,
  area: "EGGS" | "MEAT",
  quantity: number,
  name: string | null = null,
) {
  await fakePrisma.birdGroup.create({
    data: {
      id,
      farmId: FARM_ID,
      breedId: area === "MEAT" ? "breed-duck" : "breed-hen",
      name,
      sex: "UNKNOWN",
      category: "OTHER",
      area,
      quantity,
      birthOrAcquiredDate: day("2026-01-01"),
    },
  });
}

let created = 0;
async function seedUse(id: string, birdGroupId: string, date: string, quantity: number) {
  await fakePrisma.birdConsumption.create({
    data: {
      id,
      farmId: FARM_ID,
      birdGroupId,
      consumptionDate: day(date),
      quantity,
      note: null,
      // Written in seeding order, so a later seed on the same day is newer.
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, created++)),
    },
  });
}

async function seedSale(birdGroupId: string, area: "EGGS" | "MEAT", date: string, total: number) {
  await fakePrisma.birdTransaction.create({
    data: {
      farmId: FARM_ID,
      birdGroupId,
      area,
      type: "SALE",
      transactionDate: day(date),
      quantity: 1,
      unitPrice: total,
      totalAmount: total,
    },
  });
}

beforeEach(async () => {
  resetFakePrisma();
  created = 0;
  await fakePrisma.farm.create({
    data: { id: FARM_ID, ownerId: "user-1", name: "Farm", deletedAt: null },
  });
  for (const [id, name] of [
    ["breed-duck", "Pekino antis"],
    ["breed-hen", "Brama"],
  ]) {
    await fakePrisma.breed.create({ data: { id, farmId: FARM_ID, name, birdType: "CHICKEN" } });
  }
});

describe("getMeatOverview (#190)", () => {
  it("counts the birds in Mėsa groups only, split by group, largest first", async () => {
    await seedGroup("ducks", "MEAT", 12);
    await seedGroup("cockerels", "MEAT", 8, "Brama gaidukai");
    await seedGroup("eaten", "MEAT", 0, "Suvalgyti");
    await seedGroup("layers", "EGGS", 30);

    const data = await getMeatOverview(FARM_ID, NOW);
    expect(data.raising).toEqual({
      total: 20,
      byGroup: [
        { name: "Pekino antis", quantity: 12 },
        { name: "Brama gaidukai", quantity: 8 },
      ],
    });
    // The empty group is not counted, as on the card.
    expect(data.stats.groups).toBe(2);
  });

  it("counts meat use of Mėsa groups this month and this year", async () => {
    await seedGroup("ducks", "MEAT", 12);
    await seedGroup("layers", "EGGS", 30);
    await seedUse("u1", "ducks", "2026-10-21", 2);
    await seedUse("u2", "ducks", "2026-03-10", 7);
    await seedUse("u3", "ducks", "2025-12-31", 4); // last year
    await seedUse("u4", "layers", "2026-10-22", 5); // an Eggs group

    const data = await getMeatOverview(FARM_ID, NOW);
    expect(data.homeUse).toEqual({ month: 2, year: 9 });
    expect(data.stats.consumed).toBe(9);
  });

  it("shows the year's Mėsa sales and balance, as the Finansai tab does", async () => {
    await seedGroup("ducks", "MEAT", 12);
    await seedGroup("layers", "EGGS", 30);
    await seedSale("ducks", "MEAT", "2026-06-01", 100);
    await seedSale("layers", "EGGS", "2026-06-01", 40);

    const data = await getMeatOverview(FARM_ID, NOW);
    expect(data.stats.sales).toBe(100);
    expect(data.balance).toEqual(
      await getAreaFinance(FARM_ID, "MEAT", resolveFinancePeriod({}, NOW)),
    );
  });

  it("lists the latest five meat-use records of Mėsa groups, newest first", async () => {
    await seedGroup("ducks", "MEAT", 12);
    await seedGroup("cockerels", "MEAT", 8, "Brama gaidukai");
    await seedGroup("layers", "EGGS", 30);
    await seedUse("old", "ducks", "2026-01-05", 1);
    await seedUse("a", "ducks", "2026-10-01", 1);
    await seedUse("b", "cockerels", "2026-10-10", 1);
    await seedUse("c", "ducks", "2026-10-21", 2);
    await seedUse("d", "cockerels", "2026-10-21", 3); // same day, written later
    await seedUse("e", "ducks", "2026-09-15", 1);
    await seedUse("layer", "layers", "2026-10-28", 1);

    const data = await getMeatOverview(FARM_ID, NOW);
    expect(data.recent.map((r) => r.id)).toEqual(["d", "c", "b", "a", "e"]);
    expect(data.recent[0]).toEqual({
      id: "d",
      date: day("2026-10-21"),
      groupLabel: "Brama gaidukai",
      quantity: 3,
    });
  });

  it("is empty for a farm with no Mėsa groups", async () => {
    await seedGroup("layers", "EGGS", 30);
    await seedUse("layer", "layers", "2026-10-28", 1);

    const data = await getMeatOverview(FARM_ID, NOW);
    expect(data).toMatchObject({
      raising: { total: 0, byGroup: [] },
      homeUse: { month: 0, year: 0 },
      stats: { groups: 0, consumed: 0, sales: 0 },
      recent: [],
    });
  });
});

describe("listBirdTransactions with an area (#190)", () => {
  it("keeps the sales list to the sales filed under that area", async () => {
    await seedGroup("ducks", "MEAT", 12);
    await seedGroup("layers", "EGGS", 30);
    await seedSale("ducks", "MEAT", "2026-06-01", 100);
    await seedSale("layers", "EGGS", "2026-06-01", 40);

    const meat = await listBirdTransactions(FARM_ID, "SALE", "MEAT");
    expect(meat.map((t) => Number(t.totalAmount))).toEqual([100]);
    expect(await listBirdTransactions(FARM_ID, "SALE")).toHaveLength(2);
  });
});
