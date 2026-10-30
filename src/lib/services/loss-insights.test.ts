import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Story #197: the extra card on each area's Nuostoliai tab ---------------
//
// Runs the real services against the in-memory fake Prisma client
// (fake-prisma.ts) — CI has no reachable database, see the note at the top of
// multi-tenant-isolation.test.ts. The fake applies no column defaults, so
// seeded rows spell out the nullable columns.

vi.mock("@/lib/prisma", async () => {
  const { fakePrisma } = await import("./fake-prisma");
  return { prisma: fakePrisma };
});

import { fakePrisma, resetFakePrisma } from "./fake-prisma";
import { getAreaLossInsight } from "@/lib/services/losses";
import { addMotherHenLog } from "@/lib/services/mother-hens";
import { createMotherHenLogSchema } from "@/lib/validation/mother-hens";

const FARM_ID = "farm-1";
const day = (s: string) => new Date(`${s}T00:00:00Z`);
// 09:00 on October 29th 2026 in Vilnius.
const NOW = new Date("2026-10-29T07:00:00Z");

beforeEach(async () => {
  resetFakePrisma();
  await fakePrisma.farm.create({
    data: { id: FARM_ID, ownerId: "user-1", name: "Farm", deletedAt: null },
  });
});

describe("Kiaušiniai: broken eggs", () => {
  it("counts this month's broken collections only", async () => {
    for (const [date, quantity, quality] of [
      ["2026-10-02", 4, "BROKEN"],
      ["2026-10-28", 2, "BROKEN"],
      ["2026-10-28", 30, "GOOD"],
      ["2026-09-30", 9, "BROKEN"],
      ["2026-10-15", 12, null],
    ] as const) {
      await fakePrisma.eggCollection.create({
        data: { farmId: FARM_ID, collectionDate: day(date), quantity, quality },
      });
    }
    await expect(getAreaLossInsight(FARM_ID, "eggs", NOW)).resolves.toEqual({
      kind: "broken",
      count: 6,
    });
  });
});

describe("Perekšlės: broken incubating eggs from the diary", () => {
  it("adds this year's diary entries of the farm's hens", async () => {
    await fakePrisma.motherHen.create({
      data: {
        id: "hen-1",
        farmId: FARM_ID,
        name: "Rudė",
        diedAt: null,
        createdAt: day("2025-04-01"),
      },
    });
    await addMotherHenLog(FARM_ID, "hen-1", { entryDate: "2026-05-02", brokenEggs: 2 });
    await addMotherHenLog(FARM_ID, "hen-1", { entryDate: "2026-05-03", note: "Sėdi ramiai" });
    await addMotherHenLog(FARM_ID, "hen-1", { entryDate: "2025-12-30", brokenEggs: 5 });
    await expect(getAreaLossInsight(FARM_ID, "hens", NOW)).resolves.toEqual({
      kind: "broken",
      count: 2,
    });
  });

  it("is 0 for a farm without hens", async () => {
    await expect(getAreaLossInsight(FARM_ID, "hens", NOW)).resolves.toEqual({
      kind: "broken",
      count: 0,
    });
  });
});

describe("Perinimas: eggs that did not hatch", () => {
  it("counts infertile eggs by start year and unhatched ones by hatch year", async () => {
    for (const [id, start, hatch, fertile, infertile, hatched] of [
      ["spring", "2026-04-01", "2026-04-22", 10, 2, 8],
      ["new-year", "2025-12-20", "2026-01-10", 6, 3, 5],
      ["running", "2026-10-20", null, 9, 1, null],
      ["old", "2025-05-01", "2025-05-22", 9, 4, 1],
    ] as const) {
      await fakePrisma.incubationCycle.create({
        data: {
          id,
          farmId: FARM_ID,
          startDate: day(start),
          hatchDate: hatch ? day(hatch) : null,
          eggsFertile: fertile,
          eggsInfertile: infertile,
          hatchedCount: hatched,
        },
      });
    }
    // Infertile: spring 2 + running 1. Unhatched: spring 2 + new-year 1.
    await expect(getAreaLossInsight(FARM_ID, "incubation", NOW)).resolves.toEqual({
      kind: "unhatched",
      infertile: 3,
      unhatched: 3,
    });
  });
});

describe("Mėsa: feed value lost", () => {
  it("values this year's dead birds at the year's expenses per bird", async () => {
    await fakePrisma.breed.create({
      data: { id: "breed-1", farmId: FARM_ID, name: "Antis", birdType: "DUCK" },
    });
    await fakePrisma.birdGroup.create({
      data: {
        id: "g-meat",
        farmId: FARM_ID,
        breedId: "breed-1",
        name: "Antys",
        sex: "UNKNOWN",
        category: "OTHER",
        area: "MEAT",
        quantity: 17,
        birthOrAcquiredDate: day("2026-03-01"),
      },
    });
    await fakePrisma.expense.create({
      data: {
        farmId: FARM_ID,
        area: "MEAT",
        birdGroupId: null,
        motherHenId: null,
        incubationCycleId: null,
        expenseDate: day("2026-05-01"),
        category: "FEED",
        amount: "614.00",
        description: null,
      },
    });
    for (const [id, date, quantity] of [
      ["l-1", "2026-06-01", 3],
      ["l-old", "2025-06-01", 8],
    ] as const) {
      await fakePrisma.loss.create({
        data: {
          id,
          farmId: FARM_ID,
          area: "MEAT",
          birdGroupId: null,
          motherHenId: null,
          incubationCycleId: null,
          lossDate: day(date),
          quantity,
          reasonType: "PREDATOR",
          comment: null,
        },
      });
    }
    // 17 now + 3 lost = 20 birds: 30,70 € each, 3 lost ≈ 92,10 €.
    await expect(getAreaLossInsight(FARM_ID, "meat", NOW)).resolves.toEqual({
      kind: "feed",
      valueCents: 9210,
    });
  });

  it("cannot value anything without birds", async () => {
    await expect(getAreaLossInsight(FARM_ID, "meat", NOW)).resolves.toEqual({
      kind: "feed",
      valueCents: null,
    });
  });
});

describe("the diary's broken eggs field", () => {
  const parse = (brokenEggs: unknown) =>
    createMotherHenLogSchema.safeParse({ entryDate: "2026-10-29", brokenEggs });

  it("takes a whole number or nothing", () => {
    expect(parse("").data?.brokenEggs).toBeUndefined();
    expect(parse("3").data?.brokenEggs).toBe(3);
    expect(parse(0).data?.brokenEggs).toBe(0);
  });

  it("rejects negatives, fractions and words", () => {
    expect(parse("-1").success).toBe(false);
    expect(parse("1.5").success).toBe(false);
    expect(parse("1,5").success).toBe(false);
    expect(parse("du").success).toBe(false);
    // Number() would take these as 100 and 16.
    expect(parse("1e2").success).toBe(false);
    expect(parse("0x10").success).toBe(false);
  });

  it("reads blanks as nothing, not 0", () => {
    expect(parse("  ").data?.brokenEggs).toBeUndefined();
    expect(parse(" 4 ").data?.brokenEggs).toBe(4);
  });
});
