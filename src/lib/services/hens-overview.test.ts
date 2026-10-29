import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Story #188: the Perekšlės overview and broods under a hen ----------------
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
import { ValidationError } from "@/lib/errors";
import { getHensOverview } from "@/lib/services/area-overview";
import { getAreaFinance } from "@/lib/services/area-finance";
import { createIncubationCycle } from "@/lib/services/incubation";
import { deleteMotherHen, listHensFreeToSit } from "@/lib/services/mother-hens";
import { resolveFinancePeriod } from "@/lib/finance-period";

const FARM_ID = "farm-1";
const day = (s: string) => new Date(`${s}T00:00:00Z`);
// 09:00 on October 29th in Vilnius.
const NOW = new Date("2026-10-29T07:00:00Z");

async function seedHen(id: string, name: string, createdAt: string, diedAt: string | null = null) {
  await fakePrisma.motherHen.create({
    data: {
      id,
      farmId: FARM_ID,
      birdGroupId: null,
      name,
      photoUrl: null,
      description: null,
      diedAt: diedAt ? day(diedAt) : null,
      createdAt: new Date(createdAt),
    },
  });
}

async function seedCycle(
  id: string,
  motherHenId: string | null,
  startDate: string,
  hatchDate: string | null = null,
  eggsTotal: number | null = 8,
) {
  await fakePrisma.incubationCycle.create({
    data: {
      id,
      farmId: FARM_ID,
      name: id,
      motherHenId,
      eggSourceGroupId: null,
      startDate: day(startDate),
      eggsTotal,
      hatchDate: hatchDate ? day(hatchDate) : null,
    },
  });
}

async function seedLog(motherHenId: string, entryDate: string) {
  await fakePrisma.motherHenLog.create({
    data: { motherHenId, entryDate: day(entryDate), note: null, photoUrl: null },
  });
}

const cycleInput = (motherHenId: string) => ({
  name: "Vasaros perėjimas",
  startDate: "2026-10-29",
  motherHenId,
});

beforeEach(async () => {
  resetFakePrisma();
  await fakePrisma.farm.create({
    data: { id: FARM_ID, ownerId: "user-1", name: "Farm", deletedAt: null },
  });
  await seedHen("rita", "Rita", "2026-05-01T10:00:00Z");
  await seedHen("rude", "Rudė", "2026-06-01T10:00:00Z");
  await seedHen("juoda", "Juoda", "2026-04-01T10:00:00Z", "2026-09-10");
});

describe("getHensOverview", () => {
  it("lists the living hens newest first and keeps a dead hen last", async () => {
    const o = await getHensOverview(FARM_ID, NOW);
    expect(o.hens.map((h) => h.name)).toEqual(["Rudė", "Rita"]);
    expect(o.cards.map((c) => [c.name, c.status])).toEqual([
      ["Rudė", "Ilsisi"],
      ["Rita", "Ilsisi"],
      ["Juoda", "Nugaišusi"],
    ]);
  });

  it("shows a hen sitting on an unhatched cycle, with its eggs and day", async () => {
    await seedCycle("c1", "rita", "2026-10-24");
    // Hatched already, and one in the incubator: neither makes anyone sit.
    await seedCycle("c2", "rude", "2026-08-01", "2026-08-22");
    await seedCycle("c3", null, "2026-10-20");

    const o = await getHensOverview(FARM_ID, NOW);
    expect(o.sitting).toEqual([{ name: "Rita", eggs: 8, day: 6 }]);
    expect(o.cards.find((c) => c.name === "Rita")?.status).toBe("Peri");
    expect(o.cards.find((c) => c.name === "Rudė")?.status).toBe("Ilsisi");
  });

  it("lists dead hens by when they died, the latest first", async () => {
    // Added after Juoda but died before her.
    await seedHen("sena", "Sena", "2026-07-01T10:00:00Z", "2026-03-01");
    const o = await getHensOverview(FARM_ID, NOW);
    expect(o.cards.slice(-2).map((c) => c.name)).toEqual(["Juoda", "Sena"]);
  });

  it("shows a hen's latest brood should the data ever hold two open ones", async () => {
    await seedCycle("newer", "rita", "2026-10-26", null, 5);
    await seedCycle("older", "rita", "2026-10-10", null, 9);
    const o = await getHensOverview(FARM_ID, NOW);
    expect(o.sitting).toEqual([{ name: "Rita", eggs: 5, day: 4 }]);
  });

  it("counts each hen's diary entries", async () => {
    await seedLog("rita", "2026-10-01");
    await seedLog("rita", "2026-10-02");
    await seedLog("rude", "2026-10-03");

    const o = await getHensOverview(FARM_ID, NOW);
    expect(Object.fromEntries(o.cards.map((c) => [c.name, c.logs]))).toEqual({
      Rita: 2,
      Rudė: 1,
      Juoda: 0,
    });
  });

  it("takes the balance from the Perekšlės finances", async () => {
    await fakePrisma.expense.create({
      data: {
        farmId: FARM_ID,
        area: "HENS",
        birdGroupId: null,
        motherHenId: "rita",
        incubationCycleId: null,
        expenseDate: day("2026-03-01"),
        category: "MEDICINE",
        amount: 32,
        description: null,
      },
    });
    const o = await getHensOverview(FARM_ID, NOW);
    const year = await getAreaFinance(FARM_ID, "HENS", resolveFinancePeriod({}, NOW));
    expect(o.balance).toEqual(year);
    expect(o.balance).toMatchObject({ income: 0, expenses: 32, result: -32 });
    expect(o.year).toBe(2026);
  });
});

describe("a brood under a hen", () => {
  it("stores the hen on the new cycle, which makes her sit", async () => {
    const cycle = await createIncubationCycle(FARM_ID, cycleInput("rita"));
    expect(cycle.motherHenId).toBe("rita");
    expect((await getHensOverview(FARM_ID, NOW)).sitting.map((s) => s.name)).toEqual(["Rita"]);
  });

  it("still starts a cycle with no hen", async () => {
    const cycle = await createIncubationCycle(FARM_ID, cycleInput(""));
    expect(cycle.motherHenId).toBeNull();
  });

  it.each([
    ["an unknown hen", "nobody", "Pasirinkta perekšlė nerasta"],
    ["a dead hen", "juoda", "Nugaišusi perekšlė negali perėti"],
  ])("refuses %s", async (_, henId, message) => {
    await expect(createIncubationCycle(FARM_ID, cycleInput(henId))).rejects.toThrow(
      new ValidationError(message),
    );
  });

  it("refuses a hen already sitting, but allows her once that brood has hatched", async () => {
    await seedCycle("c1", "rita", "2026-10-01");
    await expect(createIncubationCycle(FARM_ID, cycleInput("rita"))).rejects.toThrow(
      "Ši perekšlė jau peri",
    );

    await fakePrisma.incubationCycle.update({
      where: { id: "c1" },
      data: { hatchDate: day("2026-10-22") },
    });
    await expect(createIncubationCycle(FARM_ID, cycleInput("rita"))).resolves.toMatchObject({
      motherHenId: "rita",
    });
  });

  it("refuses to delete a hen on an open brood, but allows it once it has hatched", async () => {
    await seedCycle("c1", "rita", "2026-10-20");
    await expect(deleteMotherHen(FARM_ID, "rita")).rejects.toThrow(
      new ValidationError("Perekšlė peri – pirmiausia užbaikite perėjimą"),
    );

    await fakePrisma.incubationCycle.update({
      where: { id: "c1" },
      data: { hatchDate: day("2026-10-28") },
    });
    await expect(deleteMotherHen(FARM_ID, "rita")).resolves.toBeUndefined();
  });

  describe("when Postgres fails the serializable save (P2034)", () => {
    const conflict = () =>
      Object.assign(new Error("could not serialize access"), { code: "P2034" });
    afterEach(() => vi.restoreAllMocks());

    it("retries a conflict with an unrelated save and starts the brood", async () => {
      const spy = vi.spyOn(fakePrisma, "$transaction").mockRejectedValueOnce(conflict());
      await expect(createIncubationCycle(FARM_ID, cycleInput("rita"))).resolves.toMatchObject({
        motherHenId: "rita",
      });
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    });

    it("refuses on retry when the race was another brood for the same hen", async () => {
      // The winning save committed her brood; this one was rolled back.
      vi.spyOn(fakePrisma, "$transaction").mockImplementationOnce(async () => {
        await seedCycle("winner", "rita", "2026-10-29");
        throw conflict();
      });
      await expect(createIncubationCycle(FARM_ID, cycleInput("rita"))).rejects.toThrow(
        new ValidationError("Ši perekšlė jau peri"),
      );
    });

    it("gives up after three conflicts", async () => {
      const spy = vi.spyOn(fakePrisma, "$transaction").mockRejectedValue(conflict());
      await expect(createIncubationCycle(FARM_ID, cycleInput("rita"))).rejects.toMatchObject({
        code: "P2034",
      });
      expect(spy).toHaveBeenCalledTimes(3);
    });
  });

  it("offers only living hens that are not sitting, by name", async () => {
    await seedCycle("c1", "rude", "2026-10-20");
    await seedHen("auksa", "Auksė", "2026-07-01T10:00:00Z");
    expect((await listHensFreeToSit(FARM_ID)).map((h) => h.name)).toEqual(["Auksė", "Rita"]);
  });
});
