// Verification of a V1 → V2 copy (#180). The same queries run against V1 and
// against V2 (inside the not-yet-committed load transaction); the copy is
// committed only if the two snapshots agree. Building SQL and comparing
// snapshots is pure and unit-tested; running the queries needs a database.
import type { CopyPlan, TablePlan } from "./plan";

export type FarmFigures = {
  /** Rows per farm-scoped table. */
  counts: Record<string, number>;
  /** All-time income: egg sales + bird sales (as getProfitLossReport). Exact numeric, as text. */
  income: string;
  /** All-time expenses: expenses + bird purchases (as getProfitLossReport). */
  expenses: string;
  /** Sum of bird_groups.quantity. */
  birds: number;
  /** Collected − sold − consumed eggs (as getEggStockReport). */
  eggStock: number;
};

export type Snapshot = {
  /** Per copied table: row count and a checksum over its copied columns. */
  tables: Record<string, { rows: number; checksum: string }>;
  farms: Record<string, FarmFigures>;
};

export type Queryable = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

export const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * Row count plus an md5 over every copied column of every row, ordered by id.
 * Equal checksums on both sides mean the copied data is identical. Values are
 * compared as their text form, so the session time zone must match (both
 * connections run with TIME ZONE 'UTC').
 */
export function checksumSql(table: TablePlan): string {
  const cols = table.columns.map((c) => `coalesce(${quoteIdent(c.name)}::text, '∅')`);
  return (
    `SELECT count(*)::int AS rows, ` +
    `coalesce(md5(string_agg(concat_ws('§', ${cols.join(", ")}), '|' ORDER BY "id" COLLATE "C")), '') AS checksum ` +
    `FROM ${quoteIdent(table.name)}`
  );
}

// Child tables with no farmId of their own, counted through their parent.
const CHILD_TABLES: Record<string, { parent: string; key: string }> = {
  mother_hen_logs: { parent: "mother_hens", key: "motherHenId" },
  incubation_growth_logs: { parent: "incubation_cycles", key: "incubationCycleId" },
};

/** Per-farm count SQL for a table, or null when the table is not farm-scoped. */
export function farmCountSql(table: TablePlan): string | null {
  const t = quoteIdent(table.name);
  if (table.name === "farms") return `SELECT "id" AS farm, 1 AS n FROM "farms"`;
  if (table.columns.some((c) => c.name === "farmId")) {
    return `SELECT "farmId" AS farm, count(*)::int AS n FROM ${t} WHERE "farmId" IS NOT NULL GROUP BY "farmId"`;
  }
  const child = CHILD_TABLES[table.name];
  if (child) {
    return (
      `SELECT p."farmId" AS farm, count(*)::int AS n FROM ${t} c ` +
      `JOIN ${quoteIdent(child.parent)} p ON p."id" = c.${quoteIdent(child.key)} GROUP BY p."farmId"`
    );
  }
  return null;
}

export const FARM_FIGURES_SQL = `
SELECT f."id" AS farm,
  (coalesce((SELECT sum("totalAmount") FROM "egg_sales" WHERE "farmId" = f."id"), 0)
   + coalesce((SELECT sum("totalAmount") FROM "bird_transactions" WHERE "farmId" = f."id" AND "type" = 'SALE'), 0))::text AS income,
  (coalesce((SELECT sum("amount") FROM "expenses" WHERE "farmId" = f."id"), 0)
   + coalesce((SELECT sum("totalAmount") FROM "bird_transactions" WHERE "farmId" = f."id" AND "type" = 'PURCHASE'), 0))::text AS expenses,
  coalesce((SELECT sum("quantity") FROM "bird_groups" WHERE "farmId" = f."id"), 0)::int AS birds,
  (coalesce((SELECT sum("quantity") FROM "egg_collections" WHERE "farmId" = f."id"), 0)
   - coalesce((SELECT sum("quantity") FROM "egg_sales" WHERE "farmId" = f."id"), 0)
   - coalesce((SELECT sum("quantity") FROM "egg_consumptions" WHERE "farmId" = f."id"), 0))::int AS egg_stock
FROM "farms" f`;

/** Runs the snapshot queries over one connection. */
export async function collectSnapshot(db: Queryable, plan: CopyPlan): Promise<Snapshot> {
  const snapshot: Snapshot = { tables: {}, farms: {} };
  const farm = (id: string): FarmFigures =>
    (snapshot.farms[id] ??= { counts: {}, income: "0", expenses: "0", birds: 0, eggStock: 0 });

  for (const table of plan.tables) {
    const { rows } = await db.query(checksumSql(table));
    snapshot.tables[table.name] = {
      rows: Number(rows[0].rows),
      checksum: String(rows[0].checksum),
    };
    const sql = farmCountSql(table);
    if (sql) {
      for (const r of (await db.query(sql)).rows)
        farm(String(r.farm)).counts[table.name] = Number(r.n);
    }
  }
  for (const r of (await db.query(FARM_FIGURES_SQL)).rows) {
    Object.assign(farm(String(r.farm)), {
      income: String(r.income),
      expenses: String(r.expenses),
      birds: Number(r.birds),
      eggStock: Number(r.egg_stock),
    });
  }
  return snapshot;
}

/**
 * Money compared as exact decimals ("12.50" equals "12.5", "-0" equals "0").
 * The sign is kept apart from the digits: BigInt("-0") is 0n, so folding it
 * into the integer part would make "-0.50" equal "0.50".
 */
export function sameAmount(a: string, b: string): boolean {
  const norm = (s: string) => {
    const t = s.trim();
    const negative = t.startsWith("-");
    const [int, frac = ""] = t.replace(/^[-+]/, "").split(".");
    const digits = `${BigInt(int || "0")}${frac.replace(/0+$/, "") ? `.${frac.replace(/0+$/, "")}` : ""}`;
    return negative && digits !== "0" ? `-${digits}` : digits;
  };
  return norm(a) === norm(b);
}

/**
 * Every difference between the V1 and V2 snapshots, as readable lines; an
 * empty list means the copy is verified.
 */
export function compareSnapshots(v1: Snapshot, v2: Snapshot): string[] {
  const out: string[] = [];

  for (const table of new Set([...Object.keys(v1.tables), ...Object.keys(v2.tables)])) {
    const a = v1.tables[table];
    const b = v2.tables[table];
    if (!a || !b) {
      out.push(`${table}: missing in ${a ? "V2" : "V1"} snapshot`);
      continue;
    }
    if (a.rows !== b.rows) out.push(`${table}: ${a.rows} rows in V1, ${b.rows} in V2`);
    else if (a.checksum !== b.checksum) out.push(`${table}: same row count, different content`);
  }

  for (const id of new Set([...Object.keys(v1.farms), ...Object.keys(v2.farms)])) {
    const a = v1.farms[id];
    const b = v2.farms[id];
    if (!a || !b) {
      out.push(`farm ${id}: missing in ${a ? "V2" : "V1"}`);
      continue;
    }
    for (const table of new Set([...Object.keys(a.counts), ...Object.keys(b.counts)])) {
      const ca = a.counts[table] ?? 0;
      const cb = b.counts[table] ?? 0;
      if (ca !== cb) out.push(`farm ${id}: ${table} ${ca} in V1, ${cb} in V2`);
    }
    if (!sameAmount(a.income, b.income)) {
      out.push(`farm ${id}: income ${a.income} in V1, ${b.income} in V2`);
    }
    if (!sameAmount(a.expenses, b.expenses)) {
      out.push(`farm ${id}: expenses ${a.expenses} in V1, ${b.expenses} in V2`);
    }
    if (a.birds !== b.birds) out.push(`farm ${id}: birds ${a.birds} in V1, ${b.birds} in V2`);
    if (a.eggStock !== b.eggStock) {
      out.push(`farm ${id}: egg stock ${a.eggStock} in V1, ${b.eggStock} in V2`);
    }
  }
  return out;
}

/** Checks on V2 alone that the area backfill left the data consistent. */
export const BACKFILL_CHECKS: { name: string; sql: string }[] = [
  {
    name: "bird groups outside Kiaušiniai / Mėsa / Perinimas",
    sql: `SELECT count(*)::int AS n FROM "bird_groups" WHERE "area" NOT IN ('EGGS', 'MEAT', 'INC')`,
  },
  {
    name: "losses with a group but no area",
    sql: `SELECT count(*)::int AS n FROM "losses" WHERE "birdGroupId" IS NOT NULL AND "area" IS NULL`,
  },
];
