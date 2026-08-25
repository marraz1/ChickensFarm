import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isEmailConfigured } from "@/lib/email";
import { pushPublicKey, vapidSubject } from "@/lib/push";
import { evaluateDue } from "@/lib/notification-schedule";

// Nothing here may be cached: a cached "ok" from a previous deployment is worse
// than no health check at all.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Same gate as /api/cron/reminders — constant-time, and closed when unset. */
function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type MigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

/**
 * What the database itself believes about its migration history.
 *
 * Read from _prisma_migrations rather than the migrations folder on purpose:
 * the folder is not bundled into the deployment, and the point of this check is
 * to learn the state of the *live* database. The workflow that calls this has
 * the repo checked out and does the folder-vs-database comparison itself.
 */
async function readMigrations() {
  const rows = await prisma.$queryRaw<MigrationRow[]>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM _prisma_migrations
    ORDER BY started_at ASC
  `;

  const applied = rows.filter((r) => r.finished_at !== null && r.rolled_back_at === null);
  // Started but never finished, and not rolled back. Prisma refuses every later
  // migration while one of these exists (P3009), so a deploy that looks merely
  // "stuck" is usually this.
  const failed = rows.filter((r) => r.finished_at === null && r.rolled_back_at === null);

  return {
    appliedCount: applied.length,
    latest: applied.at(-1)?.migration_name ?? null,
    applied: applied.map((r) => r.migration_name),
    failed: failed.map((r) => r.migration_name),
  };
}

/**
 * Aggregate reminder health. Counts only — never an address, name, or id — so
 * the response stays safe to paste into a workflow log.
 */
async function readReminders() {
  const settings = await prisma.notificationSetting.findMany({
    where: { enabled: true, OR: [{ emailEnabled: true }, { pushEnabled: true }] },
    select: { sendTime: true, timeZone: true, lastRunOn: true, lastSentAt: true },
  });

  const now = new Date();
  const byReason: Record<string, number> = {};
  for (const s of settings) {
    const reason = evaluateDue(s, now);
    byReason[reason] = (byReason[reason] ?? 0) + 1;
  }

  const lastSentAt = settings
    .map((s) => s.lastSentAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    enabled: settings.length,
    subscriptions: await prisma.pushSubscription.count(),
    byReason,
    lastSentAt: lastSentAt?.toISOString() ?? null,
  };
}

/**
 * Reports whether the deployment can actually do its job.
 *
 * Two response shapes by design. Unauthenticated callers get liveness only:
 * migration names, configuration gaps and error text are reconnaissance
 * material, and this route is deliberately outside the auth middleware so an
 * external monitor can reach it. A caller holding CRON_SECRET gets the detail.
 *
 * Configuration is reported as booleans, never values — the point is to see
 * *that* a variable is missing, and a health endpoint must never become a way
 * to read secrets back out.
 */
export async function GET(req: Request) {
  const startedAt = Date.now();
  const detailed = isAuthorized(req);

  let database: { connected: boolean; latencyMs?: number; error?: string };
  let migrations: Awaited<ReturnType<typeof readMigrations>> | null = null;
  let reminders: Awaited<ReturnType<typeof readReminders>> | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { connected: true, latencyMs: Date.now() - startedAt };
    if (detailed) {
      // Sequential rather than parallel: on a cold serverless start these are the
      // first real queries, and Neon's connection limit is easier on one at a time.
      migrations = await readMigrations();
      reminders = await readReminders();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    database = {
      connected: false,
      // Truncated, and only for an authorised caller: a Prisma connection error
      // can contain the host and user from the connection string.
      ...(detailed ? { error: message.slice(0, 300) } : {}),
    };
  }

  const status = database.connected && (migrations?.failed.length ?? 0) === 0 ? "ok" : "degraded";

  if (!detailed) {
    return NextResponse.json(
      { status, time: new Date().toISOString() },
      { status: status === "ok" ? 200 : 503 },
    );
  }

  return NextResponse.json(
    {
      status,
      time: new Date().toISOString(),
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      environment: process.env.VERCEL_ENV ?? null,
      region: process.env.VERCEL_REGION ?? null,
      database,
      migrations,
      reminders,
      config: {
        appUrl: Boolean(process.env.APP_URL),
        cronSecret: Boolean(process.env.CRON_SECRET),
        directUrl: Boolean(process.env.DIRECT_URL),
        email: isEmailConfigured(),
        emailFrom: Boolean(process.env.EMAIL_FROM),
        vapidPublicKey: Boolean(pushPublicKey()),
        vapidSubject: Boolean(vapidSubject()),
      },
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
