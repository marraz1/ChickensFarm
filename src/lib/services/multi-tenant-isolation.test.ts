import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

// --- Why this suite exists, and how it runs without a database -----------
//
// Every farmId-scoped resource in this app is guarded the same way in
// src/lib/services/*.ts: a `findFirst({ where: { id, farmId } })` (or an
// `updateMany`/`findFirst`-then-mutate pair) before any read or write reaches
// it. CodeRabbit enforces that pattern in review, but nothing previously
// exercised it at runtime — a single accidental `where: { id }` (farmId
// dropped) would silently let a Farm A user read, edit, or delete Farm B's
// eggs, birds, money, or personal data, and nothing would fail.
//
// CI has no reachable database (ci.yml's DATABASE_URL is a placeholder used
// only so `prisma generate` succeeds in postinstall — see .github/workflows/
// ci.yml), so this suite calls the real, unmodified service functions against
// an in-memory fake Prisma client (fake-prisma.ts) instead of a live Postgres/
// Neon instance. The fake is not a stub that hands back canned answers: it
// stores real rows and evaluates every `where` clause, so if a service
// function's farmId guard is ever removed, this suite goes red — see the
// "sanity check" note in the PR description for how that was verified by
// deliberately breaking one function and watching the test fail.
//
// The two-layer defense this app actually has:
//  1. src/lib/session.ts's requireFarmAccessApi/requireActiveFarmApi resolve
//     "which farm" server-side from the caller's own session + farm
//     membership — a route parameter or cookie can request a farm, but never
//     supplies data for one the caller doesn't belong to. Covered below in
//     "farm membership boundary".
//  2. Every nested resource (an egg collection, a bird group, ...) is then
//     looked up with `{ id, farmId }` in the service layer, covered by the
//     rest of this file, organized to mirror src/lib/services/*.ts.
//
// A note on status codes: the issue that tracks this suite (#79) says routes
// should return "403/404" for cross-farm ids. In practice, layer 1 failures
// throw ForbiddenError -> 403 (see src/lib/api-utils.ts), but layer 2
// failures throw the shared ValidationError -> 400, not 404 (the app uses one
// "not found" message class for both real validation errors and tenant
// mismatches). That is a genuine app convention, not a gap in this suite, so
// the assertions below check for exactly what each layer really does:
// ForbiddenError for farm membership, ValidationError (or a null read / a
// zero-row update) for resource-level cross-tenant access.

vi.mock("@/lib/prisma", async () => {
  const { fakePrisma } = await import("./fake-prisma");
  return { prisma: fakePrisma };
});
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
// requireFarmAccess/requireActiveFarm (the Server Component variants, not the
// -Api ones under test) call these; not exercised here, but importing
// src/lib/session.ts pulls in the module, so it must not blow up on import
// outside a Next.js request context.
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

import { fakePrisma, resetFakePrisma } from "./fake-prisma";
import { ValidationError } from "@/lib/errors";
import { auth } from "@/lib/auth";
import { ForbiddenError, requireFarmAccessApi } from "@/lib/session";

import { deleteBreed, getBreed, updateBreed } from "@/lib/services/breeds";
import {
  createBirdGroup,
  deleteBirdGroup,
  getBirdGroupWithEvents,
  updateBirdGroup,
} from "@/lib/services/bird-groups";
import {
  createBirdTransaction,
  deleteBirdTransaction,
  getBirdTransaction,
  updateBirdTransaction,
} from "@/lib/services/bird-transactions";
import {
  createEggCollection,
  deleteEggCollection,
  getEggCollection,
  listEggCollections,
  updateEggCollection,
} from "@/lib/services/egg-collections";
import { deleteEggSale, getEggSale, updateEggSale } from "@/lib/services/egg-sales";
import {
  deleteEggConsumption,
  getEggConsumption,
  updateEggConsumption,
} from "@/lib/services/egg-consumptions";
import { deleteExpense, getExpense, updateExpense } from "@/lib/services/expenses";
import { deleteLoss, getLoss, updateLoss } from "@/lib/services/losses";
import {
  addMotherHenLog,
  createMotherHen,
  deleteMotherHen,
  getMotherHenWithLogs,
  updateMotherHen,
} from "@/lib/services/mother-hens";
import { finalizeHatch, getIncubationCycle, recordCandling } from "@/lib/services/incubation";

const FARM_A_ID = "farm-a";
const FARM_B_ID = "farm-b";
const USER_A_ID = "user-a";
const USER_B_ID = "user-b";

function sessionFor(userId: string): Session {
  return { user: { id: userId }, expires: new Date(Date.now() + 3_600_000).toISOString() };
}

// next-auth v5's `auth` export is typed as one big union covering its several
// call shapes (bare call, middleware-wrapping call, route-handler-wrapping
// call), which defeats `vi.mocked(auth).mockResolvedValue(...)` — TS resolves
// it against the middleware-wrapping branch instead of the bare `Promise<
// Session | null>` one this suite actually exercises. Asserting the narrow
// shape used here sidesteps that without touching the real auth.ts types.
function mockSession(userId: string): void {
  (auth as unknown as { mockResolvedValue: (v: Session) => void }).mockResolvedValue(
    sessionFor(userId),
  );
}

/** Two farms, each with one member, mirroring how requireFarmAccessApi resolves membership. */
async function seedTwoFarms() {
  await fakePrisma.farm.create({
    data: { id: FARM_A_ID, ownerId: USER_A_ID, name: "Farm A", deletedAt: null },
  });
  await fakePrisma.farm.create({
    data: { id: FARM_B_ID, ownerId: USER_B_ID, name: "Farm B", deletedAt: null },
  });
  await fakePrisma.farmUser.create({
    data: { id: "fu-a", farmId: FARM_A_ID, userId: USER_A_ID, role: "OWNER" },
  });
  await fakePrisma.farmUser.create({
    data: { id: "fu-b", farmId: FARM_B_ID, userId: USER_B_ID, role: "OWNER" },
  });
}

beforeEach(() => {
  resetFakePrisma();
});

describe("farm membership boundary (src/lib/session.ts)", () => {
  // This is the check every nested-resource route relies on: the farmId a
  // service call uses comes from here, resolved from the session, never
  // trusted from a route param without this gate (see /api/farms/[farmId]).
  beforeEach(async () => {
    await seedTwoFarms();
    mockSession(USER_A_ID);
  });

  it("denies a user access to a farm they are not a member of", async () => {
    await expect(requireFarmAccessApi(FARM_B_ID)).rejects.toThrow(ForbiddenError);
  });

  it("allows a user access to their own farm", async () => {
    const { farm, user } = await requireFarmAccessApi(FARM_A_ID);
    expect(farm.id).toBe(FARM_A_ID);
    expect(user.id).toBe(USER_A_ID);
  });
});

describe("breeds", () => {
  beforeEach(async () => {
    await seedTwoFarms();
    await fakePrisma.breed.create({
      data: { id: "breed-a", farmId: FARM_A_ID, name: "Rhode Island Red", birdType: "HEN" },
    });
  });

  it("does not return another farm's breed", async () => {
    await expect(getBreed(FARM_B_ID, "breed-a")).resolves.toBeNull();
  });

  it("leaves another farm's breed untouched on update (updateMany matches zero rows)", async () => {
    // updateBreed uses updateMany rather than a guarded findFirst-then-update,
    // so a missing farmId scope would show up as a silent 0-row match rather
    // than a thrown error — worth asserting explicitly rather than assuming
    // every mutation in this codebase throws the same way.
    const result = await updateBreed(FARM_B_ID, "breed-a", { name: "Renamed by Farm B" });
    expect(result.count).toBe(0);
    await expect(getBreed(FARM_A_ID, "breed-a")).resolves.toMatchObject({
      name: "Rhode Island Red",
    });
  });

  it("refuses to delete another farm's breed", async () => {
    await expect(deleteBreed(FARM_B_ID, "breed-a")).rejects.toThrow(ValidationError);
    await expect(getBreed(FARM_A_ID, "breed-a")).resolves.not.toBeNull();
  });
});

describe("bird groups", () => {
  beforeEach(async () => {
    await seedTwoFarms();
    await fakePrisma.breed.create({
      data: { id: "breed-a", farmId: FARM_A_ID, name: "Rhode Island Red", birdType: "HEN" },
    });
    await fakePrisma.breed.create({
      data: { id: "breed-b", farmId: FARM_B_ID, name: "Leghorn", birdType: "HEN" },
    });
    await fakePrisma.birdGroup.create({
      data: {
        id: "group-a",
        farmId: FARM_A_ID,
        breedId: "breed-a",
        sex: "FEMALE",
        category: "LAYER",
        quantity: 10,
        birthOrAcquiredDate: new Date("2025-01-01"),
      },
    });
  });

  const validGroupInput = {
    breedId: "breed-b",
    sex: "FEMALE" as const,
    category: "LAYER" as const,
    quantity: 5,
    birthOrAcquiredDate: "2025-06-01",
    adjustmentNote: "",
  };

  it("refuses to create a group linked to another farm's breed", async () => {
    await expect(
      createBirdGroup(FARM_B_ID, USER_B_ID, { ...validGroupInput, breedId: "breed-a" }),
    ).rejects.toThrow(ValidationError);
  });

  it("does not return another farm's bird group", async () => {
    await expect(getBirdGroupWithEvents(FARM_B_ID, "group-a")).resolves.toBeNull();
  });

  it("refuses to update another farm's bird group", async () => {
    await expect(updateBirdGroup(FARM_B_ID, "group-a", USER_B_ID, validGroupInput)).rejects.toThrow(
      ValidationError,
    );
    await expect(getBirdGroupWithEvents(FARM_A_ID, "group-a")).resolves.toMatchObject({
      quantity: 10,
    });
  });

  it("refuses to delete another farm's bird group", async () => {
    await expect(deleteBirdGroup(FARM_B_ID, "group-a")).rejects.toThrow(ValidationError);
    await expect(getBirdGroupWithEvents(FARM_A_ID, "group-a")).resolves.not.toBeNull();
  });
});

describe("bird transactions", () => {
  beforeEach(async () => {
    await seedTwoFarms();
    await fakePrisma.birdTransaction.create({
      data: {
        id: "txn-a",
        farmId: FARM_A_ID,
        birdGroupId: null,
        type: "PURCHASE",
        transactionDate: new Date("2025-01-01"),
        quantity: 5,
        unitPrice: 10,
        totalAmount: 50,
      },
    });
  });

  const validInput = {
    type: "PURCHASE" as const,
    transactionDate: "2025-02-01",
    quantity: 3,
    unitPrice: 12,
  };

  it("does not return another farm's bird transaction", async () => {
    await expect(getBirdTransaction(FARM_B_ID, "txn-a")).resolves.toBeNull();
  });

  it("refuses to update another farm's bird transaction", async () => {
    await expect(updateBirdTransaction(FARM_B_ID, "txn-a", USER_B_ID, validInput)).rejects.toThrow(
      ValidationError,
    );
  });

  it("refuses to delete another farm's bird transaction", async () => {
    await expect(deleteBirdTransaction(FARM_B_ID, "txn-a", USER_B_ID)).rejects.toThrow(
      ValidationError,
    );
    await expect(getBirdTransaction(FARM_A_ID, "txn-a")).resolves.not.toBeNull();
  });

  it("refuses to link a transaction to another farm's bird group", async () => {
    await fakePrisma.birdGroup.create({
      data: {
        id: "group-a",
        farmId: FARM_A_ID,
        breedId: "breed-a",
        sex: "FEMALE",
        category: "LAYER",
        quantity: 10,
        birthOrAcquiredDate: new Date("2025-01-01"),
      },
    });
    await expect(
      createBirdTransaction(FARM_B_ID, USER_B_ID, { ...validInput, birdGroupId: "group-a" }),
    ).rejects.toThrow(ValidationError);
  });
});

describe("egg collections", () => {
  beforeEach(async () => {
    await seedTwoFarms();
    await fakePrisma.eggCollection.create({
      data: {
        id: "coll-a",
        farmId: FARM_A_ID,
        birdGroupId: null,
        collectionDate: new Date("2025-01-01"),
        quantity: 12,
      },
    });
    await fakePrisma.eggCollection.create({
      data: {
        id: "coll-b",
        farmId: FARM_B_ID,
        birdGroupId: null,
        collectionDate: new Date("2025-01-01"),
        quantity: 7,
      },
    });
  });

  const validInput = { collectionDate: "2025-02-01", quantity: 4 };

  it("lists only the requesting farm's collections", async () => {
    const collections = await listEggCollections(FARM_A_ID);
    expect(collections.map((c) => c.id)).toEqual(["coll-a"]);
  });

  it("does not return another farm's egg collection", async () => {
    await expect(getEggCollection(FARM_B_ID, "coll-a")).resolves.toBeNull();
  });

  it("refuses to update another farm's egg collection", async () => {
    await expect(updateEggCollection(FARM_B_ID, "coll-a", validInput)).rejects.toThrow(
      ValidationError,
    );
    await expect(getEggCollection(FARM_A_ID, "coll-a")).resolves.toMatchObject({ quantity: 12 });
  });

  it("refuses to delete another farm's egg collection", async () => {
    await expect(deleteEggCollection(FARM_B_ID, "coll-a")).rejects.toThrow(ValidationError);
    await expect(getEggCollection(FARM_A_ID, "coll-a")).resolves.not.toBeNull();
  });

  it("refuses to link a collection to another farm's bird group", async () => {
    await fakePrisma.breed.create({
      data: { id: "breed-a", farmId: FARM_A_ID, name: "Rhode Island Red", birdType: "HEN" },
    });
    await fakePrisma.birdGroup.create({
      data: {
        id: "group-a",
        farmId: FARM_A_ID,
        breedId: "breed-a",
        sex: "FEMALE",
        category: "LAYER",
        quantity: 10,
        birthOrAcquiredDate: new Date("2025-01-01"),
      },
    });
    await expect(
      createEggCollection(FARM_B_ID, { ...validInput, birdGroupId: "group-a" }),
    ).rejects.toThrow(ValidationError);
  });
});

describe("egg sales", () => {
  beforeEach(async () => {
    await seedTwoFarms();
    await fakePrisma.eggSale.create({
      data: {
        id: "sale-a",
        farmId: FARM_A_ID,
        saleDate: new Date("2025-01-01"),
        quantity: 30,
        unitPrice: 0.3,
        totalAmount: 9,
      },
    });
  });

  const validInput = { saleDate: "2025-02-01", quantity: 10, unitPrice: 0.35 };

  it("does not return another farm's egg sale", async () => {
    await expect(getEggSale(FARM_B_ID, "sale-a")).resolves.toBeNull();
  });

  it("refuses to update another farm's egg sale", async () => {
    await expect(updateEggSale(FARM_B_ID, "sale-a", validInput)).rejects.toThrow(ValidationError);
  });

  it("refuses to delete another farm's egg sale", async () => {
    await expect(deleteEggSale(FARM_B_ID, "sale-a")).rejects.toThrow(ValidationError);
    await expect(getEggSale(FARM_A_ID, "sale-a")).resolves.not.toBeNull();
  });
});

describe("egg consumptions", () => {
  beforeEach(async () => {
    await seedTwoFarms();
    await fakePrisma.eggConsumption.create({
      data: {
        id: "cons-a",
        farmId: FARM_A_ID,
        consumptionDate: new Date("2025-01-01"),
        quantity: 6,
      },
    });
  });

  const validInput = { consumptionDate: "2025-02-01", quantity: 2 };

  it("does not return another farm's egg consumption", async () => {
    await expect(getEggConsumption(FARM_B_ID, "cons-a")).resolves.toBeNull();
  });

  it("refuses to update another farm's egg consumption", async () => {
    await expect(updateEggConsumption(FARM_B_ID, "cons-a", validInput)).rejects.toThrow(
      ValidationError,
    );
  });

  it("refuses to delete another farm's egg consumption", async () => {
    await expect(deleteEggConsumption(FARM_B_ID, "cons-a")).rejects.toThrow(ValidationError);
    await expect(getEggConsumption(FARM_A_ID, "cons-a")).resolves.not.toBeNull();
  });
});

describe("expenses", () => {
  beforeEach(async () => {
    await seedTwoFarms();
    await fakePrisma.expense.create({
      data: {
        id: "exp-a",
        farmId: FARM_A_ID,
        expenseDate: new Date("2025-01-01"),
        category: "FEED",
        amount: 25.5,
      },
    });
  });

  const validInput = { expenseDate: "2025-02-01", category: "MEDICINE" as const, amount: 15 };

  it("does not return another farm's expense", async () => {
    await expect(getExpense(FARM_B_ID, "exp-a")).resolves.toBeNull();
  });

  it("refuses to update another farm's expense", async () => {
    await expect(updateExpense(FARM_B_ID, "exp-a", validInput)).rejects.toThrow(ValidationError);
    await expect(getExpense(FARM_A_ID, "exp-a")).resolves.toMatchObject({ category: "FEED" });
  });

  it("refuses to delete another farm's expense", async () => {
    await expect(deleteExpense(FARM_B_ID, "exp-a")).rejects.toThrow(ValidationError);
    await expect(getExpense(FARM_A_ID, "exp-a")).resolves.not.toBeNull();
  });
});

describe("losses", () => {
  beforeEach(async () => {
    await seedTwoFarms();
    await fakePrisma.loss.create({
      data: {
        id: "loss-a",
        farmId: FARM_A_ID,
        birdGroupId: null,
        lossDate: new Date("2025-01-01"),
        quantity: 2,
        reasonType: "PREDATOR",
      },
    });
  });

  const validInput = { lossDate: "2025-02-01", quantity: 1, reasonType: "DISEASE" as const };

  it("does not return another farm's loss", async () => {
    await expect(getLoss(FARM_B_ID, "loss-a")).resolves.toBeNull();
  });

  it("refuses to update another farm's loss", async () => {
    await expect(updateLoss(FARM_B_ID, "loss-a", USER_B_ID, validInput)).rejects.toThrow(
      ValidationError,
    );
  });

  it("refuses to delete another farm's loss", async () => {
    await expect(deleteLoss(FARM_B_ID, "loss-a", USER_B_ID)).rejects.toThrow(ValidationError);
    await expect(getLoss(FARM_A_ID, "loss-a")).resolves.not.toBeNull();
  });
});

describe("mother hens", () => {
  beforeEach(async () => {
    await seedTwoFarms();
    await fakePrisma.motherHen.create({
      data: { id: "hen-a", farmId: FARM_A_ID, birdGroupId: null, name: "Cluck" },
    });
  });

  const validInput = { name: "Renamed" };

  it("refuses to create a mother hen linked to another farm's bird group", async () => {
    await fakePrisma.breed.create({
      data: { id: "breed-a", farmId: FARM_A_ID, name: "Rhode Island Red", birdType: "HEN" },
    });
    await fakePrisma.birdGroup.create({
      data: {
        id: "group-a",
        farmId: FARM_A_ID,
        breedId: "breed-a",
        sex: "FEMALE",
        category: "LAYER",
        quantity: 10,
        birthOrAcquiredDate: new Date("2025-01-01"),
      },
    });
    await expect(
      createMotherHen(FARM_B_ID, { name: "Intruder", birdGroupId: "group-a" }),
    ).rejects.toThrow(ValidationError);
  });

  it("does not return another farm's mother hen", async () => {
    await expect(getMotherHenWithLogs(FARM_B_ID, "hen-a")).resolves.toBeNull();
  });

  it("refuses to update another farm's mother hen", async () => {
    await expect(updateMotherHen(FARM_B_ID, "hen-a", validInput)).rejects.toThrow(ValidationError);
  });

  it("refuses to delete another farm's mother hen", async () => {
    await expect(deleteMotherHen(FARM_B_ID, "hen-a")).rejects.toThrow(ValidationError);
    await expect(getMotherHenWithLogs(FARM_A_ID, "hen-a")).resolves.not.toBeNull();
  });

  it("refuses to append a diary log to another farm's mother hen", async () => {
    await expect(addMotherHenLog(FARM_B_ID, "hen-a", { entryDate: "2025-02-01" })).rejects.toThrow(
      ValidationError,
    );
  });
});

describe("incubation cycles", () => {
  beforeEach(async () => {
    await seedTwoFarms();
    await fakePrisma.incubationCycle.create({
      data: {
        id: "cycle-a",
        farmId: FARM_A_ID,
        name: "Spring batch",
        eggSourceGroupId: null,
        startDate: new Date("2025-01-01"),
        eggsTotal: 20,
      },
    });
  });

  it("does not return another farm's incubation cycle", async () => {
    await expect(getIncubationCycle(FARM_B_ID, "cycle-a")).resolves.toBeNull();
  });

  it("refuses to record candling results on another farm's cycle", async () => {
    await expect(
      recordCandling(FARM_B_ID, "cycle-a", {
        action: "candling",
        eggsFertile: 15,
        eggsInfertile: 5,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("refuses to finalize a hatch on another farm's cycle", async () => {
    await expect(
      finalizeHatch(FARM_B_ID, "cycle-a", USER_B_ID, {
        action: "hatch",
        hatchDate: "2025-01-22",
        hatchedCount: 0,
        target: { mode: "none" },
      }),
    ).rejects.toThrow(ValidationError);
  });
});
