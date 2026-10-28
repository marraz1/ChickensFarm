import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runReminderBatch } from "@/lib/services/reminders";
import { appStage } from "@/lib/app-stage";

export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // never open when unconfigured
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST rather than GET: a dispatch is not a read, and it rules out any chance of
// a prefetch or an intermediary caching it. Reached without a session because
// middleware.ts excludes /api/cron — the bearer check above is the only gate.
export async function POST(req: Request) {
  // The V2 beta never sends reminders: V1 already does, from the same users'
  // settings, so a beta run would mail everyone twice (#181). Checked first,
  // so it holds even if a CRON_SECRET is configured on the beta by mistake.
  if (appStage() === "beta") {
    return NextResponse.json({ error: "Reminders are disabled in the V2 beta" }, { status: 503 });
  }
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Errors are deliberately not routed through handleApiError: a 500 makes the
  // scheduled workflow go red, which is the only way a broken batch gets noticed.
  const result = await runReminderBatch();
  return NextResponse.json(result);
}
