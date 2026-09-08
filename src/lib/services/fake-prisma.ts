// A minimal in-memory stand-in for the generated Prisma Client, used only by
// multi-tenant-isolation.test.ts.
//
// Why this exists: CI has no reachable Postgres/Neon database (see ci.yml —
// DATABASE_URL is a placeholder used only so `prisma generate` succeeds), so a
// real database-backed integration test is not possible here. Rather than
// mock away the service functions under test (which would prove nothing),
// this fake stores real rows in Maps and evaluates every call's `where`
// clause against them. A service function's farmId-scoping branch is
// therefore genuinely exercised: delete `farmId` from a query's `where` in,
// say, egg-collections.ts, and this fake will happily hand back another
// farm's row, exactly as a real, unscoped Prisma query would against a real
// database. That is what lets the isolation tests actually go red on a
// regression instead of always passing.
//
// It implements only the query shapes actually used by src/lib/services/*.ts
// and src/lib/session.ts, verified by reading every service file:
// findMany/findFirst/findFirstOrThrow/findUnique/create/update/updateMany/
// delete/deleteMany/count, one relation filter (Farm.farmUsers.some, the
// membership check requireFarmAccessApi runs), and $transaction (invokes the
// callback with the same client — there is no real atomicity to fake, and
// none of these tests depend on it). `where` matching is flat equality per
// key, which covers every call site in this codebase. aggregate/groupBy/
// upsert are intentionally unimplemented (they throw) rather than silently
// returning a wrong answer, since nothing under test needs them.

import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

const MODEL_NAMES = [
  "farm",
  "farmUser",
  "breed",
  "birdGroup",
  "birdGroupEvent",
  "motherHen",
  "motherHenLog",
  "eggCollection",
  "eggSale",
  "eggConsumption",
  "loss",
  "expense",
  "birdTransaction",
  "incubationCycle",
  "incubationGrowthLog",
] as const;

type ModelName = (typeof MODEL_NAMES)[number];

// The one relation filter shape used in this codebase: Farm.findFirst({
// where: { farmUsers: { some: { userId, role? } } } }) in src/lib/session.ts.
const RELATIONS: Partial<Record<ModelName, Record<string, { model: ModelName; fk: string }>>> = {
  farm: {
    farmUsers: { model: "farmUser", fk: "farmId" },
  },
};

function isSomeFilter(value: unknown): value is { some: Where } {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Date) &&
    "some" in (value as Record<string, unknown>)
  );
}

let db: Record<ModelName, Map<string, Row>> = createEmptyDb();

function createEmptyDb(): Record<ModelName, Map<string, Row>> {
  const next = {} as Record<ModelName, Map<string, Row>>;
  for (const name of MODEL_NAMES) next[name] = new Map();
  return next;
}

/** Wipes all seeded data. Call from `beforeEach` so tests start from a clean farm/user set. */
export function resetFakePrisma(): void {
  db = createEmptyDb();
}

function rowsOf(model: ModelName): Row[] {
  return [...db[model].values()];
}

function matchesWhere(model: ModelName, where: Where | undefined, row: Row): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (isSomeFilter(cond)) {
      const relation = RELATIONS[model]?.[key];
      if (!relation) {
        throw new Error(`fake-prisma: no relation registered for ${model}.${key}`);
      }
      const related = rowsOf(relation.model).filter((r) => r[relation.fk] === row.id);
      if (!related.some((r) => matchesWhere(relation.model, cond.some, r))) return false;
      continue;
    }
    if (row[key] !== cond) return false;
  }
  return true;
}

function notImplemented(model: ModelName, method: string) {
  return () => {
    throw new Error(
      `fake-prisma: ${model}.${method} is not implemented (not needed by the isolation suite)`,
    );
  };
}

function createModelClient(model: ModelName) {
  return {
    async findMany(args: { where?: Where } = {}): Promise<Row[]> {
      return rowsOf(model).filter((r) => matchesWhere(model, args.where, r));
    },
    async findFirst(args: { where?: Where } = {}): Promise<Row | null> {
      return rowsOf(model).find((r) => matchesWhere(model, args.where, r)) ?? null;
    },
    async findFirstOrThrow(args: { where?: Where } = {}): Promise<Row> {
      const found = rowsOf(model).find((r) => matchesWhere(model, args.where, r));
      if (!found) throw new Error(`fake-prisma: ${model} not found (findFirstOrThrow)`);
      return found;
    },
    async findUnique(args: { where: Where }): Promise<Row | null> {
      return rowsOf(model).find((r) => matchesWhere(model, args.where, r)) ?? null;
    },
    async create(args: { data: Row }): Promise<Row> {
      const row: Row = { id: randomUUID(), createdAt: new Date(), ...args.data };
      db[model].set(row.id as string, row);
      return row;
    },
    async update(args: { where: Where; data: Row }): Promise<Row> {
      const target = rowsOf(model).find((r) => matchesWhere(model, args.where, r));
      if (!target) throw new Error(`fake-prisma: ${model} not found (update)`);
      const updated = { ...target, ...args.data };
      db[model].set(target.id as string, updated);
      return updated;
    },
    async updateMany(args: { where?: Where; data: Row }): Promise<{ count: number }> {
      const matched = rowsOf(model).filter((r) => matchesWhere(model, args.where, r));
      for (const r of matched) db[model].set(r.id as string, { ...r, ...args.data });
      return { count: matched.length };
    },
    async delete(args: { where: Where }): Promise<Row> {
      const target = rowsOf(model).find((r) => matchesWhere(model, args.where, r));
      if (!target) throw new Error(`fake-prisma: ${model} not found (delete)`);
      db[model].delete(target.id as string);
      return target;
    },
    async deleteMany(args: { where?: Where } = {}): Promise<{ count: number }> {
      const matched = rowsOf(model).filter((r) => matchesWhere(model, args.where, r));
      for (const r of matched) db[model].delete(r.id as string);
      return { count: matched.length };
    },
    async count(args: { where?: Where } = {}): Promise<number> {
      return rowsOf(model).filter((r) => matchesWhere(model, args.where, r)).length;
    },
    aggregate: notImplemented(model, "aggregate"),
    groupBy: notImplemented(model, "groupBy"),
    upsert: notImplemented(model, "upsert"),
  };
}

type ModelClient = ReturnType<typeof createModelClient>;
type FakePrisma = Record<ModelName, ModelClient> & {
  $transaction: <T>(fn: (tx: FakePrisma) => Promise<T>) => Promise<T>;
};

function buildFakePrisma(): FakePrisma {
  const client = {} as FakePrisma;
  for (const model of MODEL_NAMES) {
    client[model] = createModelClient(model);
  }
  client.$transaction = async (fn) => fn(client);
  return client;
}

// A single long-lived instance: `@/lib/prisma` is mocked to resolve to this
// exact object (see the `vi.mock` at the top of multi-tenant-isolation.test.ts),
// so every service function under test — including ones that reach it via
// `prisma.$transaction` — reads and writes the same in-memory store the test
// seeds through `fakePrisma.<model>.create(...)`. `resetFakePrisma()` clears
// its contents between tests without needing a new mocked module instance.
export const fakePrisma: FakePrisma = buildFakePrisma();
