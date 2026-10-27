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
import { createLoss, getLoss, updateLoss } from "@/lib/services/losses";
import {
  createBirdGroup,
  deleteBirdGroup,
  getBirdGroupWithEvents,
  GroupHasReferencesError,
  updateBirdGroup,
} from "@/lib/services/bird-groups";
import { createMotherHen, getMotherHenWithLogs, updateMotherHen } from "@/lib/services/mother-hens";
import { finalizeHatch, getIncubationCycle } from "@/lib/services/incubation";
import { createExpenseSchema } from "@/lib/validation/expenses";
import { createLossSchema } from "@/lib/validation/losses";
import { createBirdGroupSchema } from "@/lib/validation/bird-groups";
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
