import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Story #198: an area's finances ------------------------------------------
//
// Runs the real services against the in-memory fake Prisma client
// (fake-prisma.ts) — CI has no reachable database, see the note at the top of
// multi-tenant-isolation.test.ts. The fake applies no column defaults, so
// seeded rows spell out `area`.

vi.mock("@/lib/prisma", async () => {
  const { fakePrisma } = await import("./fake-prisma");
  return { prisma: fakePrisma };
});

import { fakePrisma, resetFakePrisma } from "./fake-prisma";
import { getAreaFinance, getAreaFinances, getFarmFinance } from "@/lib/services/area-finance";
import {
  createBirdTransaction,
  transactionArea,
  updateBirdTransaction,
} from "@/lib/services/bird-transactions";
import { getProfitLossReport } from "@/lib/services/reports";
import { areaSplits } from "@/lib/area-split";
import { farmStats } from "@/lib/farm-stats";
import type { FarmArea } from "@/generated/prisma/client";

const FARM_ID = "farm-1";
const USER_ID = "user-1";
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const PERIOD = { from: day("2026-01-01"), to: day("2026-12-31"), today: day("2026-10-29") };

async function seedGroup(id: string, area: "EGGS" | "INC" | "MEAT") {
  await fakePrisma.birdGroup.create({
    data: {
      id,
      farmId: FARM_ID,
      breedId: "breed-1",
      name: id,
      sex: "UNKNOWN",
      category: area === "INC" ? "CHICK" : "LAYER",
      area,
      quantity: 100,
      birthOrAcquiredDate: day("2026-01-01"),
    },
  });
}

function sale(
  birdGroupId: string | null,
  quantity: number,
  unitPrice: number,
  date = "2026-05-01",
) {
  return {
    type: "SALE" as const,
    transactionDate: date,
    quantity,
    unitPrice,
    birdGroupId: birdGroupId ?? "",
  };
}

async function seedExpense(id: string, area: FarmArea, amount: string, category = "FEED") {
  await fakePrisma.expense.create({
    data: {
      id,
      farmId: FARM_ID,
      area,
      birdGroupId: null,
      motherHenId: null,
      incubationCycleId: null,
      expenseDate: day("2026-04-10"),
      category,
      amount,
      description: null,
    },
  });
}

const AREAS = ["EGGS", "HENS", "INC", "MEAT", "SHARED"] as const;

/** Money in every area, with amounts that drift if summed as floats. */
async function seedMixedFarm() {
  await fakePrisma.eggSale.create({
    data: {
      farmId: FARM_ID,
      saleDate: day("2026-02-01"),
      quantity: 10,
      unitPrice: 0.33,
      totalAmount: "3.33",
      buyer: null,
    },
  });
  await createBirdTransaction(FARM_ID, USER_ID, sale("g-inc", 3, 3.33));
  await createBirdTransaction(FARM_ID, USER_ID, sale("g-meat", 1, 0.1));
  await createBirdTransaction(FARM_ID, USER_ID, sale(null, 1, 0.2));
  await createBirdTransaction(FARM_ID, USER_ID, { ...sale("g-inc", 2, 1.11), type: "PURCHASE" });
  await seedExpense("e1", "EGGS", "10.10");
  await seedExpense("e2", "HENS", "0.10", "MEDICINE");
  await seedExpense("e3", "INC", "0.20", "OTHER");
  await seedExpense("e4", "MEAT", "7.77");
  await seedExpense("e5", "SHARED", "1.01", "OTHER");
}

beforeEach(async () => {
  resetFakePrisma();
  await fakePrisma.farm.create({
    data: { id: FARM_ID, ownerId: USER_ID, name: "Farm", deletedAt: null },
  });
  await fakePrisma.breed.create({
    data: { id: "breed-1", farmId: FARM_ID, name: "Vištos", birdType: "HEN" },
  });
  await seedGroup("g-eggs", "EGGS");
  await seedGroup("g-inc", "INC");
  await seedGroup("g-meat", "MEAT");
});

describe("transactionArea", () => {
  it("files a sale under its group's area and everything else under Kiaušiniai", () => {
    expect(transactionArea("SALE", "INC")).toBe("INC");
    expect(transactionArea("SALE", "MEAT")).toBe("MEAT");
    expect(transactionArea("SALE", null)).toBe("EGGS");
    expect(transactionArea("PURCHASE", "MEAT")).toBe("EGGS");
  });
});

describe("bird transactions store their area", () => {
  it("stamps the area when a sale or purchase is saved", async () => {
    const chicks = await createBirdTransaction(FARM_ID, USER_ID, sale("g-inc", 12, 10));
    const meat = await createBirdTransaction(FARM_ID, USER_ID, sale("g-meat", 5, 20));
    const unlinked = await createBirdTransaction(FARM_ID, USER_ID, sale(null, 1, 5));
    const bought = await createBirdTransaction(FARM_ID, USER_ID, {
      ...sale("g-meat", 3, 4),
      type: "PURCHASE",
    });
    expect([chicks.area, meat.area, unlinked.area, bought.area]).toEqual([
      "INC",
      "MEAT",
      "EGGS",
      "EGGS",
    ]);
  });

  it("keeps a sale's area when its group later moves, until the sale's group changes", async () => {
    const chicks = await createBirdTransaction(FARM_ID, USER_ID, sale("g-inc", 12, 10));
    await fakePrisma.birdGroup.update({ where: { id: "g-inc" }, data: { area: "MEAT" } });

    const edited = await updateBirdTransaction(FARM_ID, chicks.id, USER_ID, sale("g-inc", 10, 10));
    expect(edited.area).toBe("INC");

    const regrouped = await updateBirdTransaction(
      FARM_ID,
      chicks.id,
      USER_ID,
      sale("g-eggs", 10, 10),
    );
    expect(regrouped.area).toBe("EGGS");
  });
});

describe("getAreaFinance", () => {
  it("counts each sale in the area it was saved under", async () => {
    await createBirdTransaction(FARM_ID, USER_ID, sale("g-inc", 12, 10));
    await createBirdTransaction(FARM_ID, USER_ID, sale("g-meat", 5, 20));
    // Moving the hatched group to Mėsa must not move last spring's chick sale.
    await fakePrisma.birdGroup.update({ where: { id: "g-inc" }, data: { area: "MEAT" } });

    const inc = await getAreaFinance(FARM_ID, "INC", PERIOD);
    const meat = await getAreaFinance(FARM_ID, "MEAT", PERIOD);
    expect(inc).toMatchObject({ income: 120, birdsSold: 12 });
    expect(meat).toMatchObject({ income: 100, birdsSold: 5 });
  });

  it("gives egg sales and bird purchases to Kiaušiniai only", async () => {
    await fakePrisma.eggSale.create({
      data: {
        farmId: FARM_ID,
        saleDate: day("2026-03-01"),
        quantity: 30,
        unitPrice: 0.3,
        totalAmount: "9.00",
        buyer: null,
      },
    });
    await createBirdTransaction(FARM_ID, USER_ID, { ...sale("g-meat", 2, 15), type: "PURCHASE" });

    const eggs = await getAreaFinance(FARM_ID, "EGGS", PERIOD);
    expect(eggs).toMatchObject({ eggIncome: 9, purchases: 30, result: -21 });
    for (const area of ["HENS", "INC", "MEAT", "SHARED"] as const) {
      const other = await getAreaFinance(FARM_ID, area, PERIOD);
      expect(other).toMatchObject({ income: 0, expenses: 0 });
    }
  });

  it("counts meat used at home from the area's groups, never as income", async () => {
    await fakePrisma.birdConsumption.create({
      data: {
        farmId: FARM_ID,
        birdGroupId: "g-meat",
        consumptionDate: day("2026-06-01"),
        quantity: 9,
        note: null,
      },
    });
    const meat = await getAreaFinance(FARM_ID, "MEAT", PERIOD);
    expect(meat).toMatchObject({ homeUse: 9, income: 0 });
    expect((await getAreaFinance(FARM_ID, "EGGS", PERIOD)).homeUse).toBe(0);
  });

  it("adds up, four areas plus Bendra, to the farm P&L to the cent", async () => {
    await seedMixedFarm();

    const areas = await Promise.all(
      (["EGGS", "HENS", "INC", "MEAT", "SHARED"] as const).map((a) =>
        getAreaFinance(FARM_ID, a, PERIOD),
      ),
    );
    const farm = await getProfitLossReport(FARM_ID, { from: PERIOD.from, to: PERIOD.to });
    const cents = (key: "income" | "expenses" | "result") =>
      areas.reduce((sum, a) => sum + Math.round(a[key] * 100), 0);

    expect(cents("income")).toBe(Math.round(farm.income * 100));
    expect(cents("expenses")).toBe(Math.round(farm.expenses * 100));
    expect(cents("result")).toBe(Math.round(farm.profit * 100));
    expect(areas[4]).toMatchObject({ income: 0, expenses: 1.01 });
  });
});

describe("getAreaFinances", () => {
  it("builds each period from one fetch exactly as getAreaFinance does", async () => {
    await seedMixedFarm();
    for (const [date, quantity] of [
      ["2026-04-03", 2],
      ["2026-10-02", 5],
    ] as const) {
      await fakePrisma.birdConsumption.create({
        data: {
          farmId: FARM_ID,
          birdGroupId: "g-meat",
          consumptionDate: day(date),
          quantity,
          note: null,
        },
      });
    }
    const april = { from: day("2026-04-01"), to: day("2026-04-30"), today: PERIOD.today };

    for (const area of AREAS) {
      const [year, month] = await getAreaFinances(FARM_ID, area, [PERIOD, april]);
      expect(year).toEqual(await getAreaFinance(FARM_ID, area, PERIOD));
      expect(month).toEqual(await getAreaFinance(FARM_ID, area, april));
    }
    // Home use is dated too, so April counts only April's birds.
    const [meatYear, meatApril] = await getAreaFinances(FARM_ID, "MEAT", [PERIOD, april]);
    expect([meatYear.homeUse, meatApril.homeUse]).toEqual([7, 2]);
  });
});

describe("getFarmFinance", () => {
  it("builds every area exactly as its own tab does", async () => {
    await seedMixedFarm();
    const farm = await getFarmFinance(FARM_ID, PERIOD);
    for (const area of AREAS) {
      expect(farm.areas[area]).toEqual(await getAreaFinance(FARM_ID, area, PERIOD));
    }
  });

  it("totals the four areas plus Bendros išlaidos, equal to the farm P&L to the cent", async () => {
    await seedMixedFarm();
    const farm = await getFarmFinance(FARM_ID, PERIOD);
    const sumCents = AREAS.reduce((sum, a) => sum + Math.round(farm.areas[a].result * 100), 0);
    expect(Math.round(farm.total.result * 100)).toBe(sumCents);

    const pl = await getProfitLossReport(FARM_ID, { from: PERIOD.from, to: PERIOD.to });
    expect(farm.total).toEqual({ income: pl.income, expenses: pl.expenses, result: pl.profit });
  });

  // #202: the overview's "Pagal sritį" donut sums the same areas; its totals
  // must never drift from the farm result next to it.
  it("gives the donut the farm total in both views", async () => {
    await seedMixedFarm();
    const farm = await getFarmFinance(FARM_ID, PERIOD);
    const splits = areaSplits(farm.areas);
    expect(splits.expenses.total).toBe(farm.total.expenses);
    expect(splits.income.total).toBe(farm.total.income);
  });

  // #204: "Daugiau statistikos" lists the same money by category and month.
  it("gives the statistics the farm's expenses by category and month, to the cent", async () => {
    await seedMixedFarm();
    const farm = await getFarmFinance(FARM_ID, PERIOD);
    const stats = farmStats(farm.areas);
    const cents = (values: number[]) => values.reduce((sum, v) => sum + Math.round(v * 100), 0);
    expect(cents(stats.categories.map((c) => c.amount))).toBe(cents([farm.total.expenses]));
    expect(cents(stats.months.map((m) => m.expenses))).toBe(cents([farm.total.expenses]));
    expect(cents(stats.months.map((m) => m.income))).toBe(cents([farm.total.income]));
  });

  it("files home use under each group's area", async () => {
    await fakePrisma.birdConsumption.create({
      data: {
        farmId: FARM_ID,
        birdGroupId: "g-meat",
        consumptionDate: day("2026-06-01"),
        quantity: 4,
        note: null,
      },
    });
    const farm = await getFarmFinance(FARM_ID, PERIOD);
    expect(farm.areas.MEAT.homeUse).toBe(4);
    expect(farm.areas.EGGS.homeUse).toBe(0);
    expect(farm.total.income).toBe(0);
  });

  it("is all zero for a farm with no records", async () => {
    const farm = await getFarmFinance(FARM_ID, PERIOD);
    expect(farm.total).toEqual({ income: 0, expenses: 0, result: 0 });
  });
});
