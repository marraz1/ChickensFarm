// Copies V1 data into the V2 database (#180). See docs/v2-environment.md.
//
//   V1_DATABASE_URL=<SELECT-only role on a V1 snapshot branch> \
//   V2_DATABASE_URL=<V2 target> \
//   npm run v2:migrate -- [--dry-run] [--report report.json]
//
// Every real run empties and reloads V2, and commits only when the copy
// matches V1 (exit 0). Any mismatch rolls V2 back and exits 1.
import { writeFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";
import { runMigration, type MigrationReport } from "./copy";
import type { Queryable } from "./verify";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function summary(report: MigrationReport): string {
  const lines = [
    `${report.dryRun ? "DRY RUN" : report.ok ? "OK" : "FAILED"}: ${report.tables.length} tables, ${report.farms} farms`,
    ...report.tables.map(
      (t) =>
        `  ${t.name}: ${t.v1Rows}${t.v2Rows !== undefined ? ` → ${t.v2Rows}` : ""}` +
        (t.v2OnlyColumns.length ? `  (V2 defaults: ${t.v2OnlyColumns.join(", ")})` : ""),
    ),
    `  not copied: ${report.excluded.join(", ")}`,
    ...report.backfill.map((b) => `  backfill check "${b.name}": ${b.count}`),
    ...report.mismatches.map((m) => `  MISMATCH ${m}`),
  ];
  return lines.join("\n");
}

async function main(): Promise<number> {
  const v1Url = process.env.V1_DATABASE_URL;
  const v2Url = process.env.V2_DATABASE_URL;
  if (!v1Url || !v2Url) {
    console.error("Set V1_DATABASE_URL and V2_DATABASE_URL.");
    return 2;
  }
  if (v1Url === v2Url) {
    console.error("V1_DATABASE_URL and V2_DATABASE_URL are the same database. Refusing.");
    return 2;
  }

  const dryRun = process.argv.includes("--dry-run");
  const reportPath = arg("--report");
  const v1Pool = new Pool({ connectionString: v1Url });
  const v2Pool = new Pool({ connectionString: v2Url });
  const v1 = await v1Pool.connect();
  const v2 = await v2Pool.connect();

  try {
    const report = await runMigration({
      v1: v1 as unknown as Queryable,
      v2: v2 as unknown as Queryable,
      dryRun,
      log: (line) => console.log(line),
    });
    console.log(summary(report));
    if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2));
    return report.ok ? 0 : 1;
  } finally {
    v1.release();
    v2.release();
    await Promise.all([v1Pool.end(), v2Pool.end()]);
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
