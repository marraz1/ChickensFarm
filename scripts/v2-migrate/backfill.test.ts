import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BACKFILL_STATEMENTS } from "./backfill";

// The ETL re-runs the migrations' area backfill after every copy; this keeps
// the two from drifting apart (#198 added the bird-transaction statement).
const MIGRATIONS = join(__dirname, "..", "..", "prisma", "migrations");
const squash = (sql: string) => sql.replace(/\s+/g, " ").trim();

const migrationSql = readdirSync(MIGRATIONS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => squash(readFileSync(join(MIGRATIONS, entry.name, "migration.sql"), "utf8")))
  .join("\n");

describe("BACKFILL_STATEMENTS", () => {
  it.each(BACKFILL_STATEMENTS.map((sql) => [sql.split("\n")[0], sql]))(
    "matches a migration: %s",
    (_, sql) => {
      expect(migrationSql).toContain(squash(sql));
    },
  );

  it("files sales after the group areas they read are set", () => {
    const saleIndex = BACKFILL_STATEMENTS.findIndex((sql) => sql.includes('"bird_transactions"'));
    const lastGroupIndex = BACKFILL_STATEMENTS.findLastIndex((sql) =>
      sql.startsWith('UPDATE "bird_groups"'),
    );
    expect(saleIndex).toBeGreaterThan(lastGroupIndex);
  });
});
