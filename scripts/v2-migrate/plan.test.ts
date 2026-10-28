import { describe, it, expect } from "vitest";
import {
  buildCopyPlan,
  topologicalOrder,
  PlanError,
  EXCLUDED_TABLES,
  type ColumnInfo,
} from "./plan";

const cols = (table: string, ...names: string[]): ColumnInfo[] =>
  names.map((column) => ({ table, column, type: column === "area" ? '"FarmArea"' : "text" }));

describe("topologicalOrder", () => {
  it("puts every table after the tables it references", () => {
    const order = topologicalOrder(
      ["losses", "farms", "bird_groups", "users"],
      [
        { table: "farms", references: "users" },
        { table: "bird_groups", references: "farms" },
        { table: "losses", references: "bird_groups" },
        { table: "losses", references: "farms" },
      ],
    );
    expect(order).toEqual(["users", "farms", "bird_groups", "losses"]);
  });

  it("ignores self-references and keys to tables outside the set", () => {
    expect(
      topologicalOrder(
        ["b", "a"],
        [
          { table: "a", references: "a" },
          { table: "b", references: "elsewhere" },
        ],
      ),
    ).toEqual(["a", "b"]);
  });

  it("refuses a foreign-key cycle", () => {
    expect(() =>
      topologicalOrder(
        ["a", "b"],
        [
          { table: "a", references: "b" },
          { table: "b", references: "a" },
        ],
      ),
    ).toThrow(/cycle between: a, b/);
  });
});

describe("buildCopyPlan", () => {
  const v1Columns = [
    ...cols("users", "id", "email", "passwordHash"),
    ...cols("farms", "id", "ownerId"),
    ...cols("expenses", "id", "farmId", "amount"),
    ...cols("push_subscriptions", "id", "userId", "endpoint"),
    ...cols("password_reset_tokens", "id", "userId"),
    ...cols("_prisma_migrations", "id", "migration_name"),
  ];
  const v2Columns = [
    ...cols("users", "id", "email", "passwordHash"),
    ...cols("farms", "id", "ownerId"),
    ...cols("expenses", "id", "farmId", "area", "amount", "birdGroupId"),
    ...cols("push_subscriptions", "id", "userId", "endpoint"),
    ...cols("password_reset_tokens", "id", "userId"),
    ...cols("_prisma_migrations", "id", "migration_name"),
  ];
  const v2ForeignKeys = [
    { table: "farms", references: "users" },
    { table: "expenses", references: "farms" },
    { table: "push_subscriptions", references: "users" },
  ];

  it("copies every table except the excluded ones, in foreign-key order", () => {
    const plan = buildCopyPlan({ v1Columns, v2Columns, v2ForeignKeys });
    expect(plan.tables.map((t) => t.name)).toEqual(["users", "farms", "expenses"]);
    expect(plan.excluded).toEqual([...EXCLUDED_TABLES]);
  });

  it("copies V1's columns typed as in V2 and leaves V2-only columns to their defaults", () => {
    const expenses = buildCopyPlan({ v1Columns, v2Columns, v2ForeignKeys }).tables[2];
    expect(expenses.columns.map((c) => c.name)).toEqual(["id", "farmId", "amount"]);
    expect(expenses.v2Only).toEqual(["area", "birdGroupId"]);
  });

  it("refuses a V1 column that V2 does not have", () => {
    const withExtra = [...v1Columns, ...cols("farms", "legacyNote")];
    expect(() => buildCopyPlan({ v1Columns: withExtra, v2Columns, v2ForeignKeys })).toThrow(
      PlanError,
    );
    expect(() => buildCopyPlan({ v1Columns: withExtra, v2Columns, v2ForeignKeys })).toThrow(
      /"farms"."legacyNote"/,
    );
  });

  it("refuses a V1 table that V2 does not have", () => {
    const withTable = [...v1Columns, ...cols("old_table", "id")];
    expect(() => buildCopyPlan({ v1Columns: withTable, v2Columns, v2ForeignKeys })).toThrow(
      /table "old_table"/,
    );
  });

  it("never copies push subscriptions, reset tokens or the migration history", () => {
    const names = buildCopyPlan({ v1Columns, v2Columns, v2ForeignKeys }).tables.map((t) => t.name);
    for (const t of EXCLUDED_TABLES) expect(names).not.toContain(t);
  });
});
