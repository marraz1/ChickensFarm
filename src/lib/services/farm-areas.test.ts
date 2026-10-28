import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Story #179: farm data is organised into areas -------------------------
//
// The area rules every V2 finance screen relies on: an expense always has
// exactly one area, its optional target must sit in that area, a loss takes
// its area from what was lost, and a group only lives in EGGS, MEAT or INC.
// Cross-farm targets are covered in multi-tenant-isolation.test.ts.
//
// Runs against the in-memory fake Prisma client for the same reason the other
// service suites do: CI has no reachable database.

vi.mock("@/lib/prisma", async () => {
  const { fakePrisma } = await import("./fake-prisma");
  return { prisma: fakePrisma };
});

import { fakePrisma, resetFakePrisma } from "./fake-prisma";
import { ValidationError } from "@/lib/errors";
import { createExpense, getExpense, updateExpense } from "@/lib/services/expenses";
import { createLoss, deleteLoss, getLoss, updateLoss } from "@/lib/services/losses";
import {
  createBirdGroup,
  deleteBirdGroup,
  getBirdGroupWithEvents,
  GroupHasReferencesError,
  listBirdGroups,
  updateBirdGroup,
} from "@/lib/services/bird-groups";
import {
  createMotherHen,
  deleteMotherHen,
  getMotherHenWithLogs,
  updateMotherHen,
} from "@/lib/services/mother-hens";
import { finalizeHatch, getIncubationCycle } from "@/lib/services/incubation";
import { getProfitLossReport } from "@/lib/services/reports";
import { createExpenseSchema } from "@/lib/validation/expenses";
import { createLossSchema } from "@/lib/validation/losses";
import { createBirdGroupSchema } from "@/lib/validation/bird-groups";
import { createMotherHenSchema } from "@/lib/validation/mother-hens";
import { farmAreaLabels } from "@/lib/labels";

const FARM_ID = "farm-1";
const USER_ID = "user-1";

const expense = { expenseDate: "2025-02-01", category: "FEED" as const, amount: 12.5 };
const loss = { lossDate: "2025-02-01", quantity: 1, reasonType: "DISEASE" as const };

async function seedGroup(id: string, area: "EGGS" | "MEAT" | "INC", quantity = 10) {
  await fakePrisma.birdGroup.create({
    data: {
      id,
      farmId: FARM_ID,
      breedId: "breed-1",
      sex: "UNKNOWN",
      category: "LAYER",
      area,
      quantity,
      birthOrAcquiredDate: new Date("2025-01-01"),
    },
  });
}

beforeEach(async () => {
  resetFakePrisma();
  await fakePrisma.breed.create({
    data: { id: "breed-1", farmId: FARM_ID, name: "Sussex", birdType: "HEN" },
  });
  await seedGroup("eggs-group", "EGGS");
  await seedGroup("meat-group", "MEAT");
  await fakePrisma.motherHen.create({
    data: { id: "hen-1", farmId: FARM_ID, birdGroupId: null, name: "Margė" },
  });
  await fakePrisma.incubationCycle.create({
    data: { id: "cycle-1", farmId: FARM_ID, name: "Pavasaris", startDate: new Date("2025-01-01") },
  });
});

describe("area labels", () => {
  it("names every area in Lithuanian", () => {
    expect(farmAreaLabels).toEqual({
      EGGS: "Kiaušiniai ir prekyba",
      HENS: "Perekšlės",
      INC: "Perinimas",
      MEAT: "Mėsiniai paukščiai",
      SHARED: "Bendra",
    });
  });
});

describe("expense area", () => {
  it("defaults to Bendra when neither an area nor a target is given", async () => {
    const created = await createExpense(FARM_ID, expense);
    expect(created).toMatchObject({ area: "SHARED", birdGroupId: null, motherHenId: null });
  });

  it("takes the area from the target when none is given", async () => {
    await expect(
      createExpense(FARM_ID, { ...expense, motherHenId: "hen-1" }),
    ).resolves.toMatchObject({ area: "HENS", motherHenId: "hen-1" });
    await expect(
      createExpense(FARM_ID, { ...expense, incubationCycleId: "cycle-1" }),
    ).resolves.toMatchObject({ area: "INC" });
    await expect(
      createExpense(FARM_ID, { ...expense, birdGroupId: "meat-group" }),
    ).resolves.toMatchObject({ area: "MEAT" });
  });

  it("stores a matching area and target", async () => {
    await expect(
      createExpense(FARM_ID, { ...expense, area: "EGGS", birdGroupId: "eggs-group" }),
    ).resolves.toMatchObject({ area: "EGGS", birdGroupId: "eggs-group" });
  });

  // #192: an expense recorded from an area counts in the whole farm's totals.
  it("counts an area expense in the farm's profit and loss", async () => {
    const range = { from: new Date("2025-01-01"), to: new Date("2025-12-31") };
    const before = (await getProfitLossReport(FARM_ID, range)).expenses;

    await createExpense(FARM_ID, {
      ...expense,
      amount: 12.5,
      area: "MEAT",
      birdGroupId: "meat-group",
    });
    await createExpense(FARM_ID, { ...expense, amount: 3, area: "HENS", motherHenId: "hen-1" });

    expect((await getProfitLossReport(FARM_ID, range)).expenses).toBeCloseTo(before + 15.5, 2);
  });

  it("rejects a target from another area with a Lithuanian message", async () => {
    await expect(
      createExpense(FARM_ID, { ...expense, area: "EGGS", birdGroupId: "meat-group" }),
    ).rejects.toThrow("Pasirinktas įrašas priklauso sričiai „Mėsiniai paukščiai“");
    await expect(
      createExpense(FARM_ID, { ...expense, area: "MEAT", motherHenId: "hen-1" }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects any target on a Bendra expense", async () => {
    await expect(
      createExpense(FARM_ID, { ...expense, area: "SHARED", incubationCycleId: "cycle-1" }),
    ).rejects.toThrow("Bendroms išlaidoms negalima");
  });

  it("rejects more than one target", async () => {
    await expect(
      createExpense(FARM_ID, { ...expense, birdGroupId: "eggs-group", motherHenId: "hen-1" }),
    ).rejects.toThrow(ValidationError);
    expect(
      createExpenseSchema.safeParse({ ...expense, birdGroupId: "a", incubationCycleId: "b" })
        .success,
    ).toBe(false);
  });

  it("keeps area and target on an update that leaves them out (the V1 form)", async () => {
    const created = await createExpense(FARM_ID, { ...expense, birdGroupId: "eggs-group" });
    await expect(
      updateExpense(FARM_ID, created.id as string, { ...expense, amount: 20 }),
    ).resolves.toMatchObject({ area: "EGGS", birdGroupId: "eggs-group", amount: 20 });
  });

  it("replaces the target as a whole and follows its area", async () => {
    const created = await createExpense(FARM_ID, { ...expense, birdGroupId: "eggs-group" });
    await expect(
      updateExpense(FARM_ID, created.id as string, { ...expense, motherHenId: "hen-1" }),
    ).resolves.toMatchObject({ area: "HENS", birdGroupId: null, motherHenId: "hen-1" });
  });

  it("rejects an area change that no longer fits the stored target", async () => {
    const created = await createExpense(FARM_ID, { ...expense, birdGroupId: "eggs-group" });
    await expect(
      updateExpense(FARM_ID, created.id as string, { ...expense, area: "MEAT" }),
    ).rejects.toThrow(ValidationError);
    await expect(getExpense(FARM_ID, created.id as string)).resolves.toMatchObject({
      area: "EGGS",
    });
  });

  it("still lets an old expense be edited after its group moved to another area", async () => {
    const created = await createExpense(FARM_ID, { ...expense, birdGroupId: "eggs-group" });
    await fakePrisma.birdGroup.update({ where: { id: "eggs-group" }, data: { area: "MEAT" } });
    await expect(
      updateExpense(FARM_ID, created.id as string, { ...expense, amount: 30 }),
    ).resolves.toMatchObject({ area: "EGGS", birdGroupId: "eggs-group", amount: 30 });
  });
});

describe("loss targets", () => {
  it("takes its area from a bird group and reduces the group", async () => {
    await expect(
      createLoss(FARM_ID, USER_ID, { ...loss, quantity: 2, birdGroupId: "meat-group" }),
    ).resolves.toMatchObject({ area: "MEAT", birdGroupId: "meat-group" });
    await expect(getBirdGroupWithEvents(FARM_ID, "meat-group")).resolves.toMatchObject({
      quantity: 8,
    });
  });

  it("can target a mother hen or an incubation cycle without touching any group", async () => {
    // A cycle loss needs hatched chicks (#195); this cycle has no hatched group.
    await fakePrisma.incubationCycle.update({
      where: { id: "cycle-1" },
      data: { hatchedCount: 6 },
    });
    await expect(
      createLoss(FARM_ID, USER_ID, { ...loss, motherHenId: "hen-1" }),
    ).resolves.toMatchObject({ area: "HENS", motherHenId: "hen-1", birdGroupId: null });
    await expect(
      createLoss(FARM_ID, USER_ID, { ...loss, quantity: 4, incubationCycleId: "cycle-1" }),
    ).resolves.toMatchObject({ area: "INC", incubationCycleId: "cycle-1" });
    await expect(fakePrisma.birdGroupEvent.count()).resolves.toBe(0);
  });

  it("has no area when nothing is targeted", async () => {
    await expect(createLoss(FARM_ID, USER_ID, loss)).resolves.toMatchObject({ area: null });
  });

  it("rejects a mother-hen loss of more than one bird", async () => {
    await expect(
      createLoss(FARM_ID, USER_ID, { ...loss, quantity: 2, motherHenId: "hen-1" }),
    ).rejects.toThrow("Perekšlės nuostolio kiekis turi būti 1");
    expect(createLossSchema.safeParse({ ...loss, quantity: 2, motherHenId: "hen-1" }).success).toBe(
      false,
    );
  });

  it("rejects more than one target", async () => {
    await expect(
      createLoss(FARM_ID, USER_ID, {
        ...loss,
        birdGroupId: "eggs-group",
        incubationCycleId: "cycle-1",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("moving a loss from a group to a hen gives the birds back and re-derives the area", async () => {
    const created = await createLoss(FARM_ID, USER_ID, { ...loss, birdGroupId: "eggs-group" });
    await expect(
      updateLoss(FARM_ID, created.id as string, USER_ID, { ...loss, motherHenId: "hen-1" }),
    ).resolves.toMatchObject({ area: "HENS", birdGroupId: null, motherHenId: "hen-1" });
    await expect(getBirdGroupWithEvents(FARM_ID, "eggs-group")).resolves.toMatchObject({
      quantity: 10,
    });
  });

  it("keeps the recorded area when the target is unchanged", async () => {
    const created = await createLoss(FARM_ID, USER_ID, { ...loss, birdGroupId: "eggs-group" });
    await fakePrisma.birdGroup.update({ where: { id: "eggs-group" }, data: { area: "MEAT" } });
    await updateLoss(FARM_ID, created.id as string, USER_ID, {
      ...loss,
      birdGroupId: "eggs-group",
      comment: "pataisyta",
    });
    await expect(getLoss(FARM_ID, created.id as string)).resolves.toMatchObject({ area: "EGGS" });
  });
});

describe("bird group area", () => {
  const group = {
    breedId: "breed-1",
    sex: "UNKNOWN" as const,
    category: "LAYER" as const,
    quantity: 3,
    birthOrAcquiredDate: "2025-03-01",
  };

  // #186: "Dedeklių grupės" and "Mėsinių grupės" each list only their area.
  it("lists one area's groups, or all of them without an area", async () => {
    await seedGroup("inc-group", "INC");
    const ids = async (area?: "EGGS" | "MEAT" | "INC") =>
      (await listBirdGroups(FARM_ID, area)).map((g) => g.id).sort();

    await expect(ids("EGGS")).resolves.toEqual(["eggs-group"]);
    await expect(ids("MEAT")).resolves.toEqual(["meat-group"]);
    await expect(ids("INC")).resolves.toEqual(["inc-group"]);
    await expect(ids()).resolves.toEqual(["eggs-group", "inc-group", "meat-group"]);
  });

  it("defaults to Kiaušiniai and accepts Mėsa", async () => {
    await expect(createBirdGroup(FARM_ID, USER_ID, group)).resolves.toMatchObject({ area: "EGGS" });
    await expect(
      createBirdGroup(FARM_ID, USER_ID, { ...group, area: "MEAT" }),
    ).resolves.toMatchObject({ area: "MEAT" });
  });

  it("only allows EGGS, MEAT or INC", () => {
    expect(createBirdGroupSchema.safeParse({ ...group, area: "INC" }).success).toBe(true);
    expect(createBirdGroupSchema.safeParse({ ...group, area: "HENS" }).success).toBe(false);
    expect(createBirdGroupSchema.safeParse({ ...group, area: "SHARED" }).success).toBe(false);
  });

  it("keeps its area on an update that leaves it out", async () => {
    await updateBirdGroup(FARM_ID, "meat-group", USER_ID, { ...group, quantity: 10 });
    await expect(getBirdGroupWithEvents(FARM_ID, "meat-group")).resolves.toMatchObject({
      area: "MEAT",
    });
  });

  it("puts hatched chicks in Perinimas", async () => {
    await finalizeHatch(FARM_ID, "cycle-1", USER_ID, {
      action: "hatch",
      hatchDate: "2025-01-22",
      hatchedCount: 6,
      target: { mode: "new", breedId: "breed-1" },
    });
    const cycle = await getIncubationCycle(FARM_ID, "cycle-1");
    await expect(
      getBirdGroupWithEvents(FARM_ID, cycle!.resultingGroupId as string),
    ).resolves.toMatchObject({ area: "INC", quantity: 6 });
  });

  it("cannot be deleted while an expense points at it", async () => {
    await createExpense(FARM_ID, { ...expense, birdGroupId: "meat-group" });
    await expect(deleteBirdGroup(FARM_ID, "meat-group")).rejects.toThrow(GroupHasReferencesError);
  });
});

describe("mother hen death", () => {
  it("records, keeps and clears the date of death", async () => {
    await updateMotherHen(FARM_ID, "hen-1", { name: "Margė", diedAt: "2025-03-04" });
    await expect(getMotherHenWithLogs(FARM_ID, "hen-1")).resolves.toMatchObject({
      diedAt: new Date("2025-03-04"),
    });

    await updateMotherHen(FARM_ID, "hen-1", { name: "Margė II" });
    await expect(getMotherHenWithLogs(FARM_ID, "hen-1")).resolves.toMatchObject({
      name: "Margė II",
      diedAt: new Date("2025-03-04"),
    });

    await updateMotherHen(FARM_ID, "hen-1", { name: "Margė II", diedAt: "" });
    await expect(getMotherHenWithLogs(FARM_ID, "hen-1")).resolves.toMatchObject({ diedAt: null });
  });

  it("rejects a date of death in the future", async () => {
    await expect(createMotherHen(FARM_ID, { name: "Rytoj", diedAt: "2999-01-01" })).rejects.toThrow(
      "Kritimo data negali būti ateityje",
    );
  });
});

describe("updates from forms that only know some targets", () => {
  it("keeps a hen's loss on the hen when the V1 form sends an empty birdGroupId", async () => {
    const created = await createLoss(FARM_ID, USER_ID, { ...loss, motherHenId: "hen-1" });
    await expect(
      updateLoss(FARM_ID, created.id as string, USER_ID, {
        ...loss,
        birdGroupId: "",
        comment: "pataisyta",
      }),
    ).resolves.toMatchObject({ motherHenId: "hen-1", area: "HENS", comment: "pataisyta" });
  });

  it("still clears a group target when the V1 form empties it", async () => {
    const created = await createLoss(FARM_ID, USER_ID, { ...loss, birdGroupId: "eggs-group" });
    await expect(
      updateLoss(FARM_ID, created.id as string, USER_ID, { ...loss, birdGroupId: "" }),
    ).resolves.toMatchObject({ birdGroupId: null, area: null });
  });

  it("gives a pre-areas loss its group's area on its next edit", async () => {
    await fakePrisma.loss.create({
      data: {
        id: "old-loss",
        farmId: FARM_ID,
        birdGroupId: "meat-group",
        motherHenId: null,
        incubationCycleId: null,
        area: null,
        lossDate: new Date("2024-12-01"),
        quantity: 1,
        reasonType: "OTHER",
      },
    });
    await expect(
      updateLoss(FARM_ID, "old-loss", USER_ID, { ...loss, birdGroupId: "meat-group" }),
    ).resolves.toMatchObject({ area: "MEAT" });
  });

  it("returns an expense to Bendra when its target is removed without an area", async () => {
    const created = await createExpense(FARM_ID, { ...expense, motherHenId: "hen-1" });
    await expect(
      updateExpense(FARM_ID, created.id as string, { ...expense, motherHenId: "" }),
    ).resolves.toMatchObject({ area: "SHARED", motherHenId: null });
  });
});

describe("mother hen references", () => {
  it("cannot be deleted while an expense or a loss points at her", async () => {
    await createLoss(FARM_ID, USER_ID, { ...loss, motherHenId: "hen-1" });
    await expect(deleteMotherHen(FARM_ID, "hen-1")).rejects.toThrow(
      "Perekšlė susieta su išlaidomis ar nuostoliais",
    );
    await expect(getMotherHenWithLogs(FARM_ID, "hen-1")).resolves.not.toBeNull();
  });

  it("rejects a date of death that does not exist", () => {
    for (const diedAt of ["2026-13-40", "2026-02-30"]) {
      expect(createMotherHenSchema.safeParse({ name: "Margė", diedAt }).success).toBe(false);
    }
    expect(createMotherHenSchema.safeParse({ name: "Margė", diedAt: "2024-02-29" }).success).toBe(
      true,
    );
  });
});

// #195: what a loss does to what was lost, and its area check.
describe("loss effects by target", () => {
  // Read the history directly: the in-memory fake does not load relations.
  const groupEvents = async (id: string) =>
    (await fakePrisma.birdGroupEvent.findMany({ where: { birdGroupId: id } })).map(
      (e) => e.eventType,
    );

  async function hatch(cycleId: string, hatchedCount: number, resultingGroupId?: string) {
    await fakePrisma.incubationCycle.update({
      where: { id: cycleId },
      data: { hatchedCount, ...(resultingGroupId ? { resultingGroupId } : {}) },
    });
  }
  const growthLogs = async (cycleId: string) =>
    (await fakePrisma.incubationGrowthLog.findMany({ where: { incubationCycleId: cycleId } }))
      .map((l) => Number(l.aliveCount))
      .sort((a, b) => b - a);

  describe("a group", () => {
    it("loses birds in its own area and records the loss in its history", async () => {
      await createLoss(FARM_ID, USER_ID, {
        ...loss,
        quantity: 3,
        area: "EGGS",
        birdGroupId: "eggs-group",
      });
      await expect(getBirdGroupWithEvents(FARM_ID, "eggs-group")).resolves.toMatchObject({
        quantity: 7,
      });
      expect(await groupEvents("eggs-group")).toContain("LOSS");
    });

    it("cannot lose more birds than it has", async () => {
      await expect(
        createLoss(FARM_ID, USER_ID, { ...loss, quantity: 11, birdGroupId: "eggs-group" }),
      ).rejects.toThrow();
      await expect(getBirdGroupWithEvents(FARM_ID, "eggs-group")).resolves.toMatchObject({
        quantity: 10,
      });
    });

    it("from another area is refused with a Lithuanian message", async () => {
      await expect(
        createLoss(FARM_ID, USER_ID, { ...loss, area: "EGGS", birdGroupId: "meat-group" }),
      ).rejects.toThrow("Pasirinktas įrašas priklauso kitai sričiai");
      await expect(getBirdGroupWithEvents(FARM_ID, "meat-group")).resolves.toMatchObject({
        quantity: 10,
      });
    });
  });

  describe("a mother hen", () => {
    it("is marked dead on the loss date", async () => {
      await createLoss(FARM_ID, USER_ID, { ...loss, area: "HENS", motherHenId: "hen-1" });
      await expect(getMotherHenWithLogs(FARM_ID, "hen-1")).resolves.toMatchObject({
        diedAt: new Date(loss.lossDate),
      });
    });

    it("cannot die twice", async () => {
      await createLoss(FARM_ID, USER_ID, { ...loss, motherHenId: "hen-1" });
      await expect(createLoss(FARM_ID, USER_ID, { ...loss, motherHenId: "hen-1" })).rejects.toThrow(
        "Ši perekšlė jau pažymėta kaip nugaišusi",
      );
    });

    it("comes back when the loss is deleted, and follows a date change", async () => {
      const l = await createLoss(FARM_ID, USER_ID, { ...loss, motherHenId: "hen-1" });
      await updateLoss(FARM_ID, l.id, USER_ID, {
        ...loss,
        lossDate: "2025-02-03",
        motherHenId: "hen-1",
      });
      await expect(getMotherHenWithLogs(FARM_ID, "hen-1")).resolves.toMatchObject({
        diedAt: new Date("2025-02-03"),
      });
      await deleteLoss(FARM_ID, l.id, USER_ID);
      await expect(getMotherHenWithLogs(FARM_ID, "hen-1")).resolves.toMatchObject({
        diedAt: null,
      });
    });

    it("keeps her loss on her: the target cannot be changed", async () => {
      const l = await createLoss(FARM_ID, USER_ID, { ...loss, motherHenId: "hen-1" });
      await expect(
        updateLoss(FARM_ID, l.id, USER_ID, { ...loss, birdGroupId: "eggs-group" }),
      ).rejects.toThrow("Ištrinkite ir įrašykite iš naujo");
    });
  });

  describe("an incubation cycle", () => {
    it("lowers the live chick count and the hatched group together", async () => {
      await seedGroup("chicks", "INC", 6);
      await hatch("cycle-1", 6, "chicks");

      await createLoss(FARM_ID, USER_ID, {
        ...loss,
        quantity: 2,
        area: "INC",
        incubationCycleId: "cycle-1",
      });

      expect(await growthLogs("cycle-1")).toEqual([4]);
      await expect(getBirdGroupWithEvents(FARM_ID, "chicks")).resolves.toMatchObject({
        quantity: 4,
      });
      expect(await groupEvents("chicks")).toContain("LOSS");
    });

    it("counts from the latest growth entry", async () => {
      await hatch("cycle-1", 10);
      await fakePrisma.incubationGrowthLog.create({
        data: { incubationCycleId: "cycle-1", logDate: new Date("2025-01-20"), aliveCount: 8 },
      });
      await fakePrisma.incubationGrowthLog.create({
        data: { incubationCycleId: "cycle-1", logDate: new Date("2025-01-25"), aliveCount: 5 },
      });

      await createLoss(FARM_ID, USER_ID, { ...loss, quantity: 1, incubationCycleId: "cycle-1" });
      expect(await growthLogs("cycle-1")).toEqual([8, 5, 4]);

      await expect(
        createLoss(FARM_ID, USER_ID, { ...loss, quantity: 5, incubationCycleId: "cycle-1" }),
      ).rejects.toThrow("Nuostolis didesnis nei gyvų jauniklių skaičius");
    });

    it("needs hatched chicks and tracking still running", async () => {
      await expect(
        createLoss(FARM_ID, USER_ID, { ...loss, incubationCycleId: "cycle-1" }),
      ).rejects.toThrow("Šis ciklas dar neturi išsiritusių jauniklių");

      await fakePrisma.incubationCycle.update({
        where: { id: "cycle-1" },
        data: { hatchedCount: 6, growthCompletedAt: new Date("2025-03-01") },
      });
      await expect(
        createLoss(FARM_ID, USER_ID, { ...loss, incubationCycleId: "cycle-1" }),
      ).rejects.toThrow("Sekimas jau užbaigtas");
    });

    it("gives everything back when the loss is deleted", async () => {
      await seedGroup("chicks", "INC", 6);
      await hatch("cycle-1", 6, "chicks");
      const l = await createLoss(FARM_ID, USER_ID, {
        ...loss,
        quantity: 2,
        incubationCycleId: "cycle-1",
      });

      await deleteLoss(FARM_ID, l.id, USER_ID);

      expect(await growthLogs("cycle-1")).toEqual([6, 4]); // the correction on top
      await expect(getBirdGroupWithEvents(FARM_ID, "chicks")).resolves.toMatchObject({
        quantity: 6,
      });
    });

    it("cannot change its size afterwards", async () => {
      await hatch("cycle-1", 6);
      const l = await createLoss(FARM_ID, USER_ID, {
        ...loss,
        quantity: 2,
        incubationCycleId: "cycle-1",
      });
      await expect(
        updateLoss(FARM_ID, l.id, USER_ID, { ...loss, quantity: 3, incubationCycleId: "cycle-1" }),
      ).rejects.toThrow("Ištrinkite ir įrašykite iš naujo");
      // Date, reason and comment stay editable.
      await expect(
        updateLoss(FARM_ID, l.id, USER_ID, {
          ...loss,
          quantity: 2,
          reasonType: "PREDATOR",
          incubationCycleId: "cycle-1",
        }),
      ).resolves.toMatchObject({ reasonType: "PREDATOR" });
    });
  });
});
