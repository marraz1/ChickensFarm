// Runs the V1 → V2 copy (#180) over two open connections.
//
// V2 is emptied and reloaded inside ONE transaction, then verified against V1
// before COMMIT: a run either leaves a complete, verified copy or nothing at
// all. Re-running reloads from scratch, so two runs give the same result as
// one. V1 is only ever read, in a READ ONLY transaction (and the CLI is
// meant to connect with a SELECT-only role on a snapshot branch).
import { BACKFILL_STATEMENTS } from "./backfill";
import {
  buildCopyPlan,
  type ColumnInfo,
  type CopyPlan,
  type ForeignKey,
  type TablePlan,
} from "./plan";
import {
  BACKFILL_CHECKS,
  collectSnapshot,
  compareSnapshots,
  quoteIdent,
  type Queryable,
} from "./verify";

const COLUMNS_SQL = `
SELECT c.relname AS "table", a.attname AS "column", format_type(a.atttypid, a.atttypmod) AS "type"
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY c.relname, a.attnum`;

const FOREIGN_KEYS_SQL = `
SELECT cl.relname AS "table", rcl.relname AS "references"
FROM pg_constraint co
JOIN pg_class cl ON cl.oid = co.conrelid
JOIN pg_class rcl ON rcl.oid = co.confrelid
JOIN pg_namespace n ON n.oid = cl.relnamespace
WHERE co.contype = 'f' AND n.nspname = 'public'`;

const BATCH_ROWS = 500;

export type MigrationReport = {
  dryRun: boolean;
  ok: boolean;
  tables: { name: string; v1Rows: number; v2Rows?: number; v2OnlyColumns: string[] }[];
  excluded: string[];
  farms: number;
  mismatches: string[];
  backfill: { name: string; count: number }[];
};

export async function loadPlan(v1: Queryable, v2: Queryable): Promise<CopyPlan> {
  const [v1Cols, v2Cols, v2Fks] = await Promise.all([
    v1.query(COLUMNS_SQL),
    v2.query(COLUMNS_SQL),
    v2.query(FOREIGN_KEYS_SQL),
  ]);
  return buildCopyPlan({
    v1Columns: v1Cols.rows as ColumnInfo[],
    v2Columns: v2Cols.rows as ColumnInfo[],
    v2ForeignKeys: v2Fks.rows as ForeignKey[],
  });
}

async function copyTable(v1: Queryable, v2: Queryable, table: TablePlan): Promise<number> {
  const names = table.columns.map((c) => quoteIdent(c.name));
  // Every value travels as text and is cast back to its V2 type on insert:
  // lossless for dates, decimals, enums and timestamps, with no JS Date
  // conversion (and so no time-zone shift) on the way.
  const select = `SELECT ${table.columns
    .map((c) => `${quoteIdent(c.name)}::text AS ${quoteIdent(c.name)}`)
    .join(", ")} FROM ${quoteIdent(table.name)} ORDER BY "id" COLLATE "C"`;
  const { rows } = await v1.query(select);

  for (let start = 0; start < rows.length; start += BATCH_ROWS) {
    const batch = rows.slice(start, start + BATCH_ROWS);
    const params: unknown[] = [];
    const tuples = batch.map((row) => {
      const slots = table.columns.map((c) => {
        params.push(row[c.name]);
        return `$${params.length}::${c.type}`;
      });
      return `(${slots.join(", ")})`;
    });
    await v2.query(
      `INSERT INTO ${quoteIdent(table.name)} (${names.join(", ")}) VALUES ${tuples.join(", ")}`,
      params,
    );
  }
  return rows.length;
}

export async function runMigration(opts: {
  v1: Queryable;
  v2: Queryable;
  dryRun: boolean;
  log: (line: string) => void;
}): Promise<MigrationReport> {
  const { v1, v2, dryRun, log } = opts;

  // Same text rendering of timestamps on both sides (checksums compare text).
  await v1.query(`SET TIME ZONE 'UTC'`);
  await v2.query(`SET TIME ZONE 'UTC'`);
  // One consistent view of V1 for the copy and the verification.
  await v1.query(`BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);

  try {
    const plan = await loadPlan(v1, v2);
    const report: MigrationReport = {
      dryRun,
      ok: false,
      tables: [],
      excluded: plan.excluded,
      farms: 0,
      mismatches: [],
      backfill: [],
    };

    if (dryRun) {
      for (const table of plan.tables) {
        const { rows } = await v1.query(`SELECT count(*)::int AS n FROM ${quoteIdent(table.name)}`);
        report.tables.push({
          name: table.name,
          v1Rows: Number(rows[0].n),
          v2OnlyColumns: table.v2Only,
        });
      }
      report.farms = report.tables.find((t) => t.name === "farms")?.v1Rows ?? 0;
      report.ok = true;
      log("Dry run: nothing written to V2.");
      return report;
    }

    await v2.query("BEGIN");
    try {
      const clear = [
        ...plan.tables.map((t) => t.name),
        ...plan.excluded.filter((t) => t !== "_prisma_migrations"),
      ];
      await v2.query(`TRUNCATE ${clear.map(quoteIdent).join(", ")} CASCADE`);

      for (const table of plan.tables) {
        const copied = await copyTable(v1, v2, table);
        report.tables.push({ name: table.name, v1Rows: copied, v2OnlyColumns: table.v2Only });
        log(`copied ${table.name}: ${copied}`);
      }
      for (const sql of BACKFILL_STATEMENTS) await v2.query(sql);

      const [before, after] = [await collectSnapshot(v1, plan), await collectSnapshot(v2, plan)];
      report.mismatches = compareSnapshots(before, after);
      report.farms = Object.keys(before.farms).length;
      for (const t of report.tables) t.v2Rows = after.tables[t.name]?.rows;

      for (const check of BACKFILL_CHECKS) {
        const { rows } = await v2.query(check.sql);
        const count = Number(rows[0].n);
        report.backfill.push({ name: check.name, count });
        if (count > 0) report.mismatches.push(`backfill: ${count} ${check.name}`);
      }

      if (report.mismatches.length > 0) {
        await v2.query("ROLLBACK");
        log("Verification failed: V2 rolled back, unchanged.");
        return report;
      }
      await v2.query("COMMIT");
      report.ok = true;
      log("Verified and committed.");
      return report;
    } catch (err) {
      await v2.query("ROLLBACK").catch(() => {});
      throw err;
    }
  } finally {
    await v1.query("ROLLBACK").catch(() => {});
  }
}
