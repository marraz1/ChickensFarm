import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Stories #188 and #189: the Perekšlės and Perinimas overviews -------------
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
import { getHensOverview, getIncubationAreaOverview } from "@/lib/services/area-overview";
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

// --- Story #189: the Perinimas overview ---------------------------------------

describe("getIncubationAreaOverview", () => {
  async function hatch(id: string, fertile: number, hatched: number, completed = false) {
    await fakePrisma.incubationCycle.update({
      where: { id },
      data: {
        eggsFertile: fertile,
        hatchedCount: hatched,
        hatchDate: day("2026-09-20"),
        growthCompletedAt: completed ? new Date("2026-10-15T10:00:00Z") : null,
      },
    });
  }

  it("counts running cycles and their eggs, a hen's brood included", async () => {
    await seedCycle("incubator", null, "2026-10-12", null, 24);
    await seedCycle("under-rita", "rita", "2026-10-21", null, 18);
    await seedCycle("old", null, "2026-08-30", null, 30);
    await hatch("old", 20, 16);

    const o = await getIncubationAreaOverview(FARM_ID, NOW);
    expect(o.active).toEqual({ count: 2, eggs: 42 });
  });

  it("counts only the fertile eggs of a candled running cycle", async () => {
    await seedCycle("candled", null, "2026-10-12", null, 24);
    await fakePrisma.incubationCycle.update({
      where: { id: "candled" },
      data: { eggsFertile: 18, eggsInfertile: 6 },
    });
    const o = await getIncubationAreaOverview(FARM_ID, NOW);
    expect(o.active).toEqual({ count: 1, eggs: 18 });
  });

  it("measures efficiency over hatched cycles only", async () => {
    await seedCycle("a", null, "2026-08-01");
    await seedCycle("b", null, "2026-08-10");
    await seedCycle("candled", null, "2026-10-20");
    await hatch("a", 20, 16);
    await hatch("b", 18, 15);
    await fakePrisma.incubationCycle.update({
      where: { id: "candled" },
      data: { eggsFertile: 22 },
    });

    const o = await getIncubationAreaOverview(FARM_ID, NOW);
    expect(o.efficiency).toMatchObject({ hatched: 31, fertile: 38 });
    expect(o.efficiency.rate).toBeCloseTo(31 / 38, 10);
  });

  it("lists running cycles first, newest start first, with their status and day", async () => {
    await seedCycle("summer", null, "2026-06-01");
    await seedCycle("autumn", null, "2026-10-12");
    await seedCycle("brood", "rita", "2026-10-21");
    await hatch("summer", 10, 9);

    const o = await getIncubationAreaOverview(FARM_ID, NOW);
    expect(o.cards.map((c) => [c.id, c.status])).toEqual([
      ["brood", "Pradėta"],
      ["autumn", "Pradėta"],
      ["summer", "Išsiritę"],
    ]);
    expect(o.cards[0].lines.started).toBe("Pradėta 2026 m. spalio 21 d. · 9-a diena");
  });

  it("knows which cycles the sheet's per-cycle actions can go to", async () => {
    await seedCycle("running", null, "2026-10-12");
    await seedCycle("raising", null, "2026-08-01");
    await seedCycle("done", null, "2026-06-01");
    await hatch("raising", 10, 9);
    await hatch("done", 10, 8, true);
    // Hatched with no chicks: nothing to raise, and it can never be finished.
    await seedCycle("failed", null, "2026-07-01");
    await hatch("failed", 10, 0);

    const o = await getIncubationAreaOverview(FARM_ID, NOW);
    expect(o.sheet).toEqual({ active: ["running"], growing: ["raising"] });
  });

  it("titles an unnamed old cycle by its start date", async () => {
    await fakePrisma.incubationCycle.create({
      data: {
        id: "legacy",
        farmId: FARM_ID,
        name: null,
        motherHenId: null,
        startDate: day("2025-05-04"),
        hatchDate: null,
      },
    });
    const o = await getIncubationAreaOverview(FARM_ID, NOW);
    expect(o.cards[0].name).toBe("Ciklas nuo 2025-05-04");
  });

  it("takes the balance from the Perinimas finances", async () => {
    const o = await getIncubationAreaOverview(FARM_ID, NOW);
    expect(o.balance).toEqual(await getAreaFinance(FARM_ID, "INC", resolveFinancePeriod({}, NOW)));
    expect(o.cards).toEqual([]);
    expect(o.efficiency.rate).toBeNull();
  });
});
