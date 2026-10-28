// Which tables and columns the V1 → V2 copy moves, and in which order (#180).
// Pure: it works on schema metadata read from both databases, so it is
// unit-tested without a database.

/** A column of a public table, with its exact SQL type (pg `format_type`). */
export type ColumnInfo = { table: string; column: string; type: string };

/** `table` has a foreign key pointing at `references`. */
export type ForeignKey = { table: string; references: string };

export type TablePlan = {
  name: string;
  /** Copied columns: present in V1 and V2, typed as in V2 (the cast target). */
  columns: { name: string; type: string }[];
  /** V2-only columns, left to their defaults and filled by the backfill. */
  v2Only: string[];
};

export type CopyPlan = {
  /** In foreign-key order: every table comes after the tables it references. */
  tables: TablePlan[];
  /** Emptied in V2 on every run but never copied (see EXCLUDED_TABLES). */
  excluded: string[];
};

/**
 * Never copied:
 * - Prisma's migration history: each database keeps its own.
 * - Push subscriptions: bound to the V1 origin, useless on the V2 domain.
 * - Password-reset tokens: short-lived secrets for V1 links.
 */
export const EXCLUDED_TABLES = [
  "_prisma_migrations",
  "push_subscriptions",
  "password_reset_tokens",
] as const;

export class PlanError extends Error {}

function groupByTable(columns: ColumnInfo[]): Map<string, ColumnInfo[]> {
  const byTable = new Map<string, ColumnInfo[]>();
  for (const col of columns) {
    const list = byTable.get(col.table) ?? [];
    list.push(col);
    byTable.set(col.table, list);
  }
  return byTable;
}

/**
 * Builds the copy plan. Refuses (PlanError) anything that would silently lose
 * V1 data: a V1 table or column V2 does not have.
 */
export function buildCopyPlan(input: {
  v1Columns: ColumnInfo[];
  v2Columns: ColumnInfo[];
  v2ForeignKeys: ForeignKey[];
}): CopyPlan {
  const excluded = new Set<string>(EXCLUDED_TABLES);
  const v1 = groupByTable(input.v1Columns);
  const v2 = groupByTable(input.v2Columns);

  const problems: string[] = [];
  const plans = new Map<string, TablePlan>();
  for (const [table, v1Cols] of v1) {
    if (excluded.has(table)) continue;
    const v2Cols = v2.get(table);
    if (!v2Cols) {
      problems.push(`table "${table}" exists in V1 but not in V2`);
      continue;
    }
    const v2ByName = new Map(v2Cols.map((c) => [c.column, c]));
    const columns: TablePlan["columns"] = [];
    for (const col of v1Cols) {
      const target = v2ByName.get(col.column);
      if (!target) problems.push(`column "${table}"."${col.column}" exists in V1 but not in V2`);
      else columns.push({ name: col.column, type: target.type });
    }
    const v1Names = new Set(v1Cols.map((c) => c.column));
    plans.set(table, {
      name: table,
      columns,
      v2Only: v2Cols.filter((c) => !v1Names.has(c.column)).map((c) => c.column),
    });
  }
  if (problems.length > 0) {
    throw new PlanError(`V1 data would be lost:\n- ${problems.join("\n- ")}`);
  }

  const order = topologicalOrder([...plans.keys()], input.v2ForeignKeys);
  return { tables: order.map((t) => plans.get(t)!), excluded: [...EXCLUDED_TABLES] };
}

/**
 * Orders tables so each comes after every table it references (Kahn's
 * algorithm). Self-references and keys to tables outside `tables` are
 * ignored; a cycle is a PlanError. Ties are broken by name, so the order is
 * stable from run to run.
 */
export function topologicalOrder(tables: string[], foreignKeys: ForeignKey[]): string[] {
  const inSet = new Set(tables);
  const deps = new Map(tables.map((t) => [t, new Set<string>()]));
  for (const fk of foreignKeys) {
    if (fk.table === fk.references || !inSet.has(fk.table) || !inSet.has(fk.references)) continue;
    deps.get(fk.table)!.add(fk.references);
  }

  const order: string[] = [];
  const done = new Set<string>();
  while (order.length < tables.length) {
    const ready = tables
      .filter((t) => !done.has(t) && [...deps.get(t)!].every((d) => done.has(d)))
      .sort();
    if (ready.length === 0) {
      const stuck = tables.filter((t) => !done.has(t)).sort();
      throw new PlanError(`foreign-key cycle between: ${stuck.join(", ")}`);
    }
    for (const t of ready) {
      order.push(t);
      done.add(t);
    }
  }
  return order;
}
