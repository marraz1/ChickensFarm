// A minimal in-memory stand-in for the generated Prisma Client, used by the
// service-layer suites that cannot reach a database: multi-tenant-isolation,
// bird-consumptions and flock-reductions.
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
// delete/deleteMany/count/aggregate/groupBy, one relation filter
// (Farm.farmUsers.some, the membership check requireFarmAccessApi runs), and
// $transaction (invokes the callback with the same client — there is no real
// atomicity to fake, and none of these tests depend on it). `where` matching
// is equality per key plus the scalar operators the report queries use
// (gte/lte/gt/lt/equals/in/not). `upsert` is intentionally unimplemented (it
// throws) rather than silently returning a wrong answer, since nothing under
// test needs it.
//
// aggregate/groupBy support `_sum` only, and match Prisma in returning `null`
// for a summed field when no row matched — the services under test rely on
// that (`_sum.quantity ?? 0`), so faking a 0 would leave the fallback
// untested. They exist because the flock-reduction report (reports.ts) is
// what proves meat/food use never lands in the loss-by-reason buckets, and
// that report cannot run without them.
//
// `include`/`select`/`orderBy` are ignored: rows come back whole and in
// insertion order. Assert on ids and scalars, not on nested relations.

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
  "birdConsumption",
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
    if (isOperatorFilter(cond)) {
      if (!matchesOperators(row[key], cond)) return false;
      continue;
    }
    if (!valuesEqual(row[key], cond)) return false;
  }
  return true;
}

// The scalar filter operators used by src/lib/services/*.ts — the report
// queries bound a date column with gte/lte, data-presence uses `in`. A filter
// object counts as one only when *every* key is an operator, so a nested
// relation filter still raises the "no relation registered" error above
// instead of being silently treated as a comparison.
const OPERATORS = ["equals", "gt", "gte", "lt", "lte", "in", "not"] as const;

function isOperatorFilter(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  if (value instanceof Date || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => (OPERATORS as readonly string[]).includes(k));
}

/** Dates compare by instant, not by reference — `new Date(x) !== new Date(x)`. */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function compareValues(a: unknown, b: unknown): number {
  const left = a instanceof Date ? a.getTime() : a;
  const right = b instanceof Date ? b.getTime() : b;
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "string" && typeof right === "string") {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  throw new Error(`fake-prisma: cannot order ${typeof left} against ${typeof right}`);
}

function matchesOperators(value: unknown, filter: Record<string, unknown>): boolean {
  for (const [op, operand] of Object.entries(filter)) {
    switch (op) {
      case "equals":
        if (!valuesEqual(value, operand)) return false;
        break;
      case "not":
        if (valuesEqual(value, operand)) return false;
        break;
      case "in":
        if (!(operand as unknown[]).some((o) => valuesEqual(value, o))) return false;
        break;
      // A null column never satisfies a range bound, same as SQL.
      case "gt":
        if (value == null || compareValues(value, operand) <= 0) return false;
        break;
      case "gte":
        if (value == null || compareValues(value, operand) < 0) return false;
        break;
      case "lt":
        if (value == null || compareValues(value, operand) >= 0) return false;
        break;
      case "lte":
        if (value == null || compareValues(value, operand) > 0) return false;
        break;
    }
  }
  return true;
}

/**
 * `_sum` over the matched rows. Prisma returns null for a summed field when the
 * matched set is empty, and every caller in this codebase writes
 * `_sum.x ?? 0` — returning 0 here would make that fallback untested.
 */
function sumFields(rows: Row[], select: Record<string, boolean> | undefined) {
  const sums: Record<string, number | null> = {};
  for (const field of Object.keys(select ?? {})) {
    sums[field] = rows.length === 0 ? null : rows.reduce((t, r) => t + Number(r[field] ?? 0), 0);
  }
  return sums;
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
    async aggregate(
      args: { where?: Where; _sum?: Record<string, boolean> } = {},
    ): Promise<{ _sum: Record<string, number | null> }> {
      const matched = rowsOf(model).filter((r) => matchesWhere(model, args.where, r));
      return { _sum: sumFields(matched, args._sum) };
    },
    async groupBy(args: {
      by: string[];
      where?: Where;
      _sum?: Record<string, boolean>;
    }): Promise<Row[]> {
      const matched = rowsOf(model).filter((r) => matchesWhere(model, args.where, r));
      const buckets = new Map<string, Row[]>();
      for (const row of matched) {
        const key = JSON.stringify(
          args.by.map((field) => {
            const value = row[field];
            return value instanceof Date ? value.getTime() : value;
          }),
        );
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(row);
      }
      return [...buckets.values()].map((groupRows) => {
        const group: Row = {};
        for (const field of args.by) group[field] = groupRows[0][field];
        group._sum = sumFields(groupRows, args._sum);
        return group;
      });
    },
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
