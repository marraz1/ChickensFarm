import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

// --- Why this suite exists, and how it runs without a database -----------
//
// Every farmId-scoped resource in this app is guarded the same way in
// src/lib/services/*.ts: a `findFirst({ where: { id, farmId } })` (or an
// `updateMany`/`findFirst`-then-mutate pair) before any read or write reaches
// it. REVIEW.md documents that pattern for review, but nothing previously
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
  listBirdGroups,
  updateBirdGroup,
} from "@/lib/services/bird-groups";
import {
  createBirdTransaction,
  deleteBirdTransaction,
  getBirdTransaction,
  updateBirdTransaction,
} from "@/lib/services/bird-transactions";
import {
  createBirdConsumption,
  deleteBirdConsumption,
  getBirdConsumption,
  listBirdConsumptions,
  updateBirdConsumption,
} from "@/lib/services/bird-consumptions";
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
import {
  createExpense,
  deleteExpense,
  getAreaExpenses,
  getExpense,
  listExpenses,
  updateExpense,
} from "@/lib/services/expenses";
import {
  createLoss,
  deleteLoss,
  getAreaLosses,
  getLoss,
  listLosses,
  updateLoss,
} from "@/lib/services/losses";
import {
  addMotherHenLog,
  createMotherHen,
  deleteMotherHen,
  getMotherHenWithLogs,
  listHensFreeToSit,
  updateMotherHen,
} from "@/lib/services/mother-hens";
import {
  createIncubationCycle,
  finalizeHatch,
  getIncubationCycle,
  recordCandling,
} from "@/lib/services/incubation";
import { listAreaTargetOptions } from "@/lib/services/area-targets";
import { getAreaFinance, getFarmFinance } from "@/lib/services/area-finance";
import {
  getEggsOverview,
  getHensOverview,
  getIncubationAreaOverview,
} from "@/lib/services/area-overview";

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

  // #186: the area lists ("Dedeklių grupės", "Mėsinių grupės") stay farm-scoped.
  it("never lists another farm's groups in an area list", async () => {
    // The in-memory fake applies no column defaults, so give farm A an
    // explicit Mėsa group next to group-a.
    await fakePrisma.birdGroup.create({
      data: {
        id: "group-a-meat",
        farmId: FARM_A_ID,
        breedId: "breed-a",
        sex: "MALE",
        category: "COCKEREL",
        area: "MEAT",
        quantity: 4,
        birthOrAcquiredDate: new Date("2025-01-01"),
      },
    });

    await expect(listBirdGroups(FARM_B_ID, "MEAT")).resolves.toEqual([]);
    await expect(listBirdGroups(FARM_B_ID)).resolves.toEqual([]);
    const own = await listBirdGroups(FARM_A_ID, "MEAT");
    expect(own.map((g) => g.id)).toEqual(["group-a-meat"]);
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

describe("bird consumptions (used for meat/food)", () => {
  beforeEach(async () => {
    await seedTwoFarms();
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
    await fakePrisma.birdConsumption.create({
      data: {
        id: "cons-a",
        farmId: FARM_A_ID,
        birdGroupId: "group-a",
        consumptionDate: new Date("2025-01-01"),
        quantity: 2,
      },
    });
  });

  const validInput = {
    consumptionDate: "2025-02-01",
    birdGroupId: "group-a",
    quantity: 1,
  };

  it("does not return another farm's record", async () => {
    await expect(getBirdConsumption(FARM_B_ID, "cons-a")).resolves.toBeNull();
  });

  it("does not list another farm's records", async () => {
    await expect(listBirdConsumptions(FARM_B_ID)).resolves.toEqual([]);
  });

  it("refuses to update another farm's record", async () => {
    await expect(updateBirdConsumption(FARM_B_ID, "cons-a", USER_B_ID, validInput)).rejects.toThrow(
      ValidationError,
    );
  });

  it("refuses to delete another farm's record", async () => {
    await expect(deleteBirdConsumption(FARM_B_ID, "cons-a", USER_B_ID)).rejects.toThrow(
      ValidationError,
    );
    await expect(getBirdConsumption(FARM_A_ID, "cons-a")).resolves.not.toBeNull();
  });

  it("refuses to link a record to another farm's bird group", async () => {
    await expect(createBirdConsumption(FARM_B_ID, USER_B_ID, validInput)).rejects.toThrow(
      ValidationError,
    );
  });

  it("refuses to move a record onto another farm's bird group", async () => {
    await fakePrisma.birdGroup.create({
      data: {
        id: "group-b",
        farmId: FARM_B_ID,
        breedId: "breed-b",
        sex: "FEMALE",
        category: "LAYER",
        quantity: 5,
        birthOrAcquiredDate: new Date("2025-01-01"),
      },
    });
    await expect(
      updateBirdConsumption(FARM_A_ID, "cons-a", USER_A_ID, {
        ...validInput,
        birdGroupId: "group-b",
      }),
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

// #179: an expense or a loss can point at a bird group, a mother hen or an
// incubation cycle. Each of those references must be checked against the
// caller's farm, exactly like the birdGroupId links above.
// #192: the target choices on an area's expense form only ever list the
// active farm's own, current targets. (Bird groups are covered end to end:
// the in-memory fake returns rows without their breed.)
describe("expense target options", () => {
  beforeEach(async () => {
    await seedTwoFarms();
    // The fake applies no column defaults, so the "current" markers are explicit.
    for (const [id, farmId, diedAt] of [
      ["hen-a", FARM_A_ID, null],
      ["hen-a-dead", FARM_A_ID, new Date("2025-03-01")],
      ["hen-b", FARM_B_ID, null],
    ] as const) {
      await fakePrisma.motherHen.create({
        data: { id, farmId, birdGroupId: null, name: id, diedAt },
      });
    }
    for (const [id, farmId, growthCompletedAt] of [
      ["cycle-a", FARM_A_ID, null],
      ["cycle-a-done", FARM_A_ID, new Date("2025-03-01")],
      ["cycle-b", FARM_B_ID, null],
    ] as const) {
      await fakePrisma.incubationCycle.create({
        data: { id, farmId, name: id, startDate: new Date("2025-01-01"), growthCompletedAt },
      });
    }
  });

  it("lists only this farm's living mother hens", async () => {
    const ids = (await listAreaTargetOptions(FARM_A_ID, "hens", "expense")).map((o) => o.id);
    expect(ids).toEqual(["hen-a"]);
    const other = (await listAreaTargetOptions(FARM_B_ID, "hens", "expense")).map((o) => o.id);
    expect(other).toEqual(["hen-b"]);
  });

  it("lists only this farm's incubation cycles still being tracked", async () => {
    const ids = (await listAreaTargetOptions(FARM_A_ID, "incubation", "expense")).map((o) => o.id);
    expect(ids).toEqual(["cycle-a"]);
    const other = (await listAreaTargetOptions(FARM_B_ID, "incubation", "expense")).map(
      (o) => o.id,
    );
    expect(other).toEqual(["cycle-b"]);
  });
});

// #195: what a loss can be recorded against, and what it may never touch.
describe("loss targets and effects across farms", () => {
  beforeEach(async () => {
    await seedTwoFarms();
    await fakePrisma.motherHen.create({
      data: { id: "hen-a", farmId: FARM_A_ID, birdGroupId: null, name: "hen-a", diedAt: null },
    });
    // Explicit nulls: the in-memory fake applies no column defaults.
    for (const [id, farmId, hatchedCount] of [
      ["cycle-a-hatched", FARM_A_ID, 6],
      ["cycle-a-waiting", FARM_A_ID, null],
      ["cycle-b-hatched", FARM_B_ID, 4],
    ] as const) {
      await fakePrisma.incubationCycle.create({
        data: {
          id,
          farmId,
          name: id,
          startDate: new Date("2025-01-01"),
          hatchedCount,
          growthCompletedAt: null,
          resultingGroupId: null,
        },
      });
    }
  });

  it("offers only this farm's hatched cycles for a loss", async () => {
    const ids = (await listAreaTargetOptions(FARM_A_ID, "incubation", "loss")).map((o) => o.id);
    expect(ids).toEqual(["cycle-a-hatched"]);
    const other = (await listAreaTargetOptions(FARM_B_ID, "incubation", "loss")).map((o) => o.id);
    expect(other).toEqual(["cycle-b-hatched"]);
  });

  it("never marks another farm's mother hen dead", async () => {
    await expect(
      createLoss(FARM_B_ID, USER_B_ID, {
        lossDate: "2025-02-01",
        quantity: 1,
        reasonType: "DISEASE",
        area: "HENS",
        motherHenId: "hen-a",
      }),
    ).rejects.toThrow(ValidationError);
    await expect(fakePrisma.motherHen.findFirst({ where: { id: "hen-a" } })).resolves.toMatchObject(
      { diedAt: null },
    );
  });

  it("never lowers another farm's chick count", async () => {
    await expect(
      createLoss(FARM_B_ID, USER_B_ID, {
        lossDate: "2025-02-01",
        quantity: 1,
        reasonType: "DISEASE",
        area: "INC",
        incubationCycleId: "cycle-a-hatched",
      }),
    ).rejects.toThrow(ValidationError);
    await expect(
      fakePrisma.incubationGrowthLog.count({ where: { incubationCycleId: "cycle-a-hatched" } }),
    ).resolves.toBe(0);
  });
});

// #194: an area's Išlaidos tab lists only the active farm's expenses and, for
// Kiaušiniai, only its own bird purchases.
describe("area expense list", () => {
  const now = new Date("2026-10-28T12:00:00Z");

  beforeEach(async () => {
    await seedTwoFarms();
    for (const [id, farmId, area] of [
      ["exp-a-eggs", FARM_A_ID, "EGGS"],
      ["exp-a-meat", FARM_A_ID, "MEAT"],
      ["exp-b-eggs", FARM_B_ID, "EGGS"],
    ] as const) {
      await fakePrisma.expense.create({
        data: {
          id,
          farmId,
          area,
          birdGroupId: null,
          motherHenId: null,
          incubationCycleId: null,
          expenseDate: new Date("2026-10-01"),
          category: "FEED",
          amount: 10,
          description: null,
          createdAt: new Date("2026-10-01T10:00:00Z"),
        },
      });
    }
    for (const [id, farmId] of [
      ["buy-a", FARM_A_ID],
      ["buy-b", FARM_B_ID],
    ] as const) {
      await fakePrisma.birdTransaction.create({
        data: {
          id,
          farmId,
          birdGroupId: null,
          type: "PURCHASE",
          transactionDate: new Date("2026-10-02"),
          quantity: 2,
          unitPrice: 5,
          totalAmount: 10,
          createdAt: new Date("2026-10-02T10:00:00Z"),
        },
      });
    }
  });

  it("never shows another farm's expenses or purchases", async () => {
    const eggsB = await getAreaExpenses(FARM_B_ID, "EGGS", { now });
    expect(eggsB.rows.map((r) => r.key).sort()).toEqual(["expense-exp-b-eggs", "purchase-buy-b"]);
    expect(eggsB.total).toBe(20);

    const eggsA = await getAreaExpenses(FARM_A_ID, "EGGS", { now });
    expect(eggsA.rows.map((r) => r.key).sort()).toEqual(["expense-exp-a-eggs", "purchase-buy-a"]);
  });

  it("keeps each area to its own expenses, purchases in Kiaušiniai only", async () => {
    const meatA = await getAreaExpenses(FARM_A_ID, "MEAT", { now });
    expect(meatA.rows.map((r) => r.key)).toEqual(["expense-exp-a-meat"]);
    await expect(getAreaExpenses(FARM_A_ID, "HENS", { now })).resolves.toMatchObject({ rows: [] });
  });
});

describe("area loss list", () => {
  const now = new Date("2026-10-28T12:00:00Z");

  beforeEach(async () => {
    await seedTwoFarms();
    for (const [id, farmId, area] of [
      ["loss-a-meat", FARM_A_ID, "MEAT"],
      ["loss-a-eggs", FARM_A_ID, "EGGS"],
      ["loss-b-meat", FARM_B_ID, "MEAT"],
    ] as const) {
      await fakePrisma.loss.create({
        data: {
          id,
          farmId,
          area,
          birdGroupId: null,
          motherHenId: null,
          incubationCycleId: null,
          lossDate: new Date("2026-10-01"),
          quantity: 2,
          reasonType: "PREDATOR",
          comment: null,
          createdAt: new Date("2026-10-01T10:00:00Z"),
        },
      });
    }
    // Meat used at home is never a loss.
    await fakePrisma.birdConsumption.create({
      data: {
        id: "eaten-a",
        farmId: FARM_A_ID,
        birdGroupId: null,
        consumptionDate: new Date("2026-10-03"),
        quantity: 5,
        createdAt: new Date("2026-10-03T10:00:00Z"),
      },
    });
  });

  it("never shows another farm's losses", async () => {
    const meatB = await getAreaLosses(FARM_B_ID, "MEAT", { now });
    expect(meatB.rows.map((r) => r.key)).toEqual(["loss-b-meat"]);
    expect(meatB.total).toBe(2);
  });

  it("keeps each area to its own losses, without meat used at home", async () => {
    const meatA = await getAreaLosses(FARM_A_ID, "MEAT", { now });
    expect(meatA.rows.map((r) => r.key)).toEqual(["loss-a-meat"]);
    expect(meatA.total).toBe(2);
    await expect(getAreaLosses(FARM_A_ID, "HENS", { now })).resolves.toMatchObject({
      rows: [],
      total: 0,
    });
  });

  it("counts only this year in the card but still lists last year's losses", async () => {
    await fakePrisma.loss.create({
      data: {
        id: "loss-a-meat-2025",
        farmId: FARM_A_ID,
        area: "MEAT",
        birdGroupId: null,
        motherHenId: null,
        incubationCycleId: null,
        lossDate: new Date("2025-12-31"),
        quantity: 5,
        reasonType: "DISEASE",
        comment: null,
        createdAt: new Date("2025-12-31T10:00:00Z"),
      },
    });
    const meatA = await getAreaLosses(FARM_A_ID, "MEAT", { now });
    expect(meatA.total).toBe(2);
    expect(meatA.byReason.map((r) => r.count)).toEqual([0, 2, 0]);
    expect(meatA.rows.map((r) => r.key)).toEqual(["loss-a-meat", "loss-a-meat-2025"]);
  });
});

describe("area finance", () => {
  const period = {
    from: new Date("2026-01-01"),
    to: new Date("2026-12-31"),
    today: new Date("2026-10-28"),
  };

  beforeEach(async () => {
    await seedTwoFarms();
    for (const farmId of [FARM_A_ID, FARM_B_ID]) {
      const tag = farmId === FARM_A_ID ? "a" : "b";
      // Farm B's money is ten times farm A's, so a leak shows in every total.
      const k = farmId === FARM_A_ID ? 1 : 10;
      await fakePrisma.breed.create({
        data: { id: `breed-${tag}`, farmId, name: "Antys", birdType: "DUCK" },
      });
      await fakePrisma.birdGroup.create({
        data: {
          id: `meat-${tag}`,
          farmId,
          breedId: `breed-${tag}`,
          name: null,
          sex: "UNKNOWN",
          category: "OTHER",
          area: "MEAT",
          quantity: 50,
          birthOrAcquiredDate: new Date("2026-01-01"),
        },
      });
      await fakePrisma.eggSale.create({
        data: {
          farmId,
          saleDate: new Date("2026-03-01"),
          quantity: 10,
          unitPrice: 0.5,
          totalAmount: 5 * k,
          buyer: null,
        },
      });
      await fakePrisma.birdTransaction.create({
        data: {
          farmId,
          birdGroupId: `meat-${tag}`,
          area: "MEAT",
          type: "SALE",
          transactionDate: new Date("2026-04-01"),
          quantity: k,
          unitPrice: 20,
          totalAmount: 20 * k,
        },
      });
      await fakePrisma.expense.create({
        data: {
          farmId,
          area: "MEAT",
          birdGroupId: null,
          motherHenId: null,
          incubationCycleId: null,
          expenseDate: new Date("2026-04-02"),
          category: "FEED",
          amount: 7 * k,
          description: null,
        },
      });
      await fakePrisma.birdConsumption.create({
        data: {
          farmId,
          birdGroupId: `meat-${tag}`,
          consumptionDate: new Date("2026-05-01"),
          quantity: 3 * k,
          note: null,
        },
      });
    }
  });

  it("never counts another farm's sales, expenses or home use", async () => {
    const meatA = await getAreaFinance(FARM_A_ID, "MEAT", period);
    expect(meatA).toMatchObject({ income: 20, birdsSold: 1, expenses: 7, homeUse: 3 });
    const eggsA = await getAreaFinance(FARM_A_ID, "EGGS", period);
    expect(eggsA).toMatchObject({ income: 5, eggIncome: 5, expenses: 0, homeUse: 0 });

    const meatB = await getAreaFinance(FARM_B_ID, "MEAT", period);
    expect(meatB).toMatchObject({ income: 200, expenses: 70, homeUse: 30 });
  });

  it("keeps the farm overview's result to the farm's own money", async () => {
    const farmA = await getFarmFinance(FARM_A_ID, period);
    expect(farmA.total).toEqual({ income: 25, expenses: 7, result: 18 });
    expect(farmA.areas.MEAT.homeUse).toBe(3);

    const farmB = await getFarmFinance(FARM_B_ID, period);
    expect(farmB.total).toEqual({ income: 250, expenses: 70, result: 180 });
  });

  it("keeps the Kiaušiniai overview to the farm's own eggs, groups and money", async () => {
    const now = new Date("2026-10-28T12:00:00Z");
    // Each farm sold 10 eggs and has one Mėsa group, so neither has layers.
    const eggsA = await getEggsOverview(FARM_A_ID, now);
    expect(eggsA).toMatchObject({ eggStock: -10, flock: { total: 0, groups: 0 } });
    expect(eggsA.balance).toMatchObject({ income: 5, expenses: 0 });

    const eggsB = await getEggsOverview(FARM_B_ID, now);
    expect(eggsB.balance).toMatchObject({ income: 50 });
  });

  it("keeps each area to its own money, egg sales in Kiaušiniai only", async () => {
    for (const area of ["HENS", "INC", "SHARED"] as const) {
      await expect(getAreaFinance(FARM_A_ID, area, period)).resolves.toMatchObject({
        income: 0,
        expenses: 0,
        hasRecords: false,
      });
    }
    expect((await getAreaFinance(FARM_A_ID, "MEAT", period)).eggIncome).toBe(0);
  });
});

describe("Perekšlės overview and broods under a hen", () => {
  beforeEach(async () => {
    await seedTwoFarms();
    for (const [id, farmId, name] of [
      ["hen-a", FARM_A_ID, "Rita"],
      ["hen-b", FARM_B_ID, "Svetima"],
    ] as const) {
      await fakePrisma.motherHen.create({
        data: { id, farmId, birdGroupId: null, name, photoUrl: null, diedAt: null },
      });
    }
    // Farm B's hen sits and keeps a diary.
    await fakePrisma.incubationCycle.create({
      data: {
        id: "cycle-b",
        farmId: FARM_B_ID,
        name: "B",
        motherHenId: "hen-b",
        eggSourceGroupId: null,
        startDate: new Date("2026-10-20"),
        eggsTotal: 9,
        hatchDate: null,
      },
    });
    await fakePrisma.motherHenLog.create({
      data: { motherHenId: "hen-b", entryDate: new Date("2026-10-21"), note: null, photoUrl: null },
    });
  });

  it("never shows another farm's hens, broods or diary entries", async () => {
    const hensA = await getHensOverview(FARM_A_ID, new Date("2026-10-28T12:00:00Z"));
    expect(hensA.hens.map((h) => h.name)).toEqual(["Rita"]);
    expect(hensA.sitting).toEqual([]);
    expect(hensA.cards).toEqual([
      expect.objectContaining({ name: "Rita", status: "Ilsisi", logs: 0 }),
    ]);
  });

  it("never starts a brood under another farm's hen", async () => {
    await expect(
      createIncubationCycle(FARM_A_ID, {
        name: "Svetimas",
        startDate: "2026-10-28",
        motherHenId: "hen-b",
      }),
    ).rejects.toThrow(ValidationError);
    expect((await listHensFreeToSit(FARM_A_ID)).map((h) => h.id)).toEqual(["hen-a"]);
  });

  it("never shows another farm's cycles on the Perinimas overview", async () => {
    const now = new Date("2026-10-28T12:00:00Z");
    const incA = await getIncubationAreaOverview(FARM_A_ID, now);
    expect(incA).toMatchObject({ active: { count: 0, eggs: 0 }, cards: [] });
    expect(incA.sheet).toEqual({ active: [], growing: [] });

    const incB = await getIncubationAreaOverview(FARM_B_ID, now);
    expect(incB.active).toEqual({ count: 1, eggs: 9 });
  });
});

describe("expense and loss targets (farm areas)", () => {
  beforeEach(async () => {
    await seedTwoFarms();
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
        area: "EGGS",
        quantity: 10,
        birthOrAcquiredDate: new Date("2025-01-01"),
      },
    });
    await fakePrisma.motherHen.create({
      data: { id: "hen-a", farmId: FARM_A_ID, birdGroupId: null, name: "Cluck" },
    });
    await fakePrisma.incubationCycle.create({
      data: { id: "cycle-a", farmId: FARM_A_ID, name: "Spring", startDate: new Date("2025-01-01") },
    });
    await fakePrisma.expense.create({
      data: {
        id: "exp-b",
        farmId: FARM_B_ID,
        area: "SHARED",
        birdGroupId: null,
        motherHenId: null,
        incubationCycleId: null,
        expenseDate: new Date("2025-01-01"),
        category: "FEED",
        amount: 10,
      },
    });
  });

  const expense = { expenseDate: "2025-02-01", category: "FEED" as const, amount: 5 };
  const loss = { lossDate: "2025-02-01", quantity: 1, reasonType: "DISEASE" as const };
  const foreignTargets = [
    { birdGroupId: "group-a" },
    { motherHenId: "hen-a" },
    { incubationCycleId: "cycle-a" },
  ];

  it.each(foreignTargets)("refuses an expense targeting another farm's %o", async (target) => {
    await expect(createExpense(FARM_B_ID, { ...expense, ...target })).rejects.toThrow(
      ValidationError,
    );
    await expect(listExpenses(FARM_B_ID)).resolves.toHaveLength(1);
  });

  it.each(foreignTargets)("refuses to move an expense onto another farm's %o", async (target) => {
    await expect(updateExpense(FARM_B_ID, "exp-b", { ...expense, ...target })).rejects.toThrow(
      ValidationError,
    );
    await expect(getExpense(FARM_B_ID, "exp-b")).resolves.toMatchObject({
      birdGroupId: null,
      motherHenId: null,
      incubationCycleId: null,
    });
  });

  it.each(foreignTargets)("refuses a loss targeting another farm's %o", async (target) => {
    await expect(createLoss(FARM_B_ID, USER_B_ID, { ...loss, ...target })).rejects.toThrow(
      ValidationError,
    );
    await expect(listLosses(FARM_B_ID)).resolves.toHaveLength(0);
    await expect(getBirdGroupWithEvents(FARM_A_ID, "group-a")).resolves.toMatchObject({
      quantity: 10,
    });
  });
});
