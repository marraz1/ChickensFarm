import { describe, it, expect } from "vitest";
import { checksumSql, compareSnapshots, farmCountSql, sameAmount, type Snapshot } from "./verify";

const table = (name: string, ...columns: string[]) => ({
  name,
  columns: columns.map((c) => ({ name: c, type: "text" })),
  v2Only: [],
});

function snapshot(): Snapshot {
  return {
    tables: {
      users: { rows: 2, checksum: "aaa" },
      expenses: { rows: 3, checksum: "bbb" },
    },
    farms: {
      f1: { counts: { expenses: 3 }, income: "120.50", expenses: "80.00", birds: 24, eggStock: 86 },
    },
  };
}

describe("sameAmount", () => {
  it.each([
    ["12.50", "12.5"],
    ["80.00", "80"],
    ["0.00", "0"],
    ["-0.00", "0"],
    ["-3.10", "-3.1"],
    ["007.20", "7.2"],
  ])("%s equals %s", (a, b) => {
    expect(sameAmount(a, b)).toBe(true);
  });

  it.each([
    ["-0.50", "0.50"],
    ["-5.00", "5.00"],
    ["0.01", "0.10"],
    ["12.50", "12.51"],
  ])("%s differs from %s", (a, b) => {
    expect(sameAmount(a, b)).toBe(false);
  });
});

describe("compareSnapshots", () => {
  it("finds nothing when both sides agree", () => {
    expect(compareSnapshots(snapshot(), snapshot())).toEqual([]);
  });

  it("treats equal amounts with different scale as equal", () => {
    const v2 = snapshot();
    v2.farms.f1.income = "120.5";
    v2.farms.f1.expenses = "80";
    expect(compareSnapshots(snapshot(), v2)).toEqual([]);
  });

  it("reports a row-count difference", () => {
    const v2 = snapshot();
    v2.tables.users.rows = 1;
    expect(compareSnapshots(snapshot(), v2)).toEqual(["users: 2 rows in V1, 1 in V2"]);
  });

  it("reports changed content behind an equal row count", () => {
    const v2 = snapshot();
    v2.tables.expenses.checksum = "zzz";
    expect(compareSnapshots(snapshot(), v2)).toEqual([
      "expenses: same row count, different content",
    ]);
  });

  it.each([
    [
      "income",
      (s: Snapshot) => (s.farms.f1.income = "120.51"),
      "farm f1: income 120.50 in V1, 120.51 in V2",
    ],
    [
      "expenses",
      (s: Snapshot) => (s.farms.f1.expenses = "79.99"),
      "farm f1: expenses 80.00 in V1, 79.99 in V2",
    ],
    ["birds", (s: Snapshot) => (s.farms.f1.birds = 23), "farm f1: birds 24 in V1, 23 in V2"],
    [
      "egg stock",
      (s: Snapshot) => (s.farms.f1.eggStock = 85),
      "farm f1: egg stock 86 in V1, 85 in V2",
    ],
    [
      "per-farm count",
      (s: Snapshot) => (s.farms.f1.counts.expenses = 2),
      "farm f1: expenses 3 in V1, 2 in V2",
    ],
  ])("reports a %s difference for the farm", (_, change, expected) => {
    const v2 = snapshot();
    change(v2);
    expect(compareSnapshots(snapshot(), v2)).toEqual([expected]);
  });

  it("reports a farm or table missing on one side", () => {
    const v2 = snapshot();
    delete v2.farms.f1;
    delete v2.tables.users;
    expect(compareSnapshots(snapshot(), v2)).toEqual([
      "users: missing in V2 snapshot",
      "farm f1: missing in V2",
    ]);
  });
});

describe("SQL builders", () => {
  it("checksums every copied column in a stable order", () => {
    const sql = checksumSql(table("expenses", "id", "amount"));
    expect(sql).toContain(`coalesce("id"::text, '∅'), coalesce("amount"::text, '∅')`);
    expect(sql).toContain(`ORDER BY "id" COLLATE "C"`);
    expect(sql).toContain(`FROM "expenses"`);
  });

  it("counts farm-scoped, child and farm rows per farm, and skips user-level tables", () => {
    expect(farmCountSql(table("expenses", "id", "farmId"))).toContain(`GROUP BY "farmId"`);
    expect(farmCountSql(table("mother_hen_logs", "id", "motherHenId"))).toContain(
      `JOIN "mother_hens" p ON p."id" = c."motherHenId"`,
    );
    expect(farmCountSql(table("farms", "id"))).toContain(`FROM "farms"`);
    expect(farmCountSql(table("users", "id", "email"))).toBeNull();
  });

  it("quotes identifiers safely", () => {
    expect(checksumSql(table('we"ird', "id"))).toContain(`FROM "we""ird"`);
  });
});
