import { NextResponse } from "next/server";

// V1 read-only mode for the V2 cutover (#239, part of #182). While the final
// copy of V1's data into V2 runs, nothing may be saved in V1 — it would be
// left behind. `READ_ONLY_MODE=true` in Vercel, then a rebuild (Redeploy),
// freezes every change, pauses the reminder cron and shows a banner; reading
// and signing in keep working. Off unless set to exactly "true", so V1
// behaves as before.
//
// The middleware checks every route it sees. Routes its matcher skips
// (api/auth, api/cron) call refuseWhileReadOnly themselves, and
// read-only.test.ts fails if a writing one there does not.

export const READ_ONLY_MESSAGE =
  "Programėlė perkeliama į naują versiją. Pakeitimų išsaugoti kol kas negalima.";
export const READ_ONLY_BANNER =
  "Programėlė perkeliama į naują versiją. Kol kas duomenų keisti negalima.";

export function isReadOnlyMode(env: Record<string, string | undefined> = process.env): boolean {
  return env.READ_ONLY_MODE === "true";
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Writes that only touch the visitor's own session, so owners can still sign
// in and switch farms to read their data. Everything else under /api/auth/
// belongs to NextAuth (sign-in, sign-out, session) apart from these two,
// which create a user or change a password.
const AUTH_WRITES = ["/api/auth/register", "/api/auth/password-reset"];
const SESSION_ONLY = ["/api/active-farm"];

const under = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Whether a request would change data, and so is refused while V1 is read-only. */
export function blocksWhileReadOnly(method: string, pathname: string): boolean {
  if (!under(pathname, "/api")) return false;
  if (SAFE_METHODS.has(method.toUpperCase())) return false;
  if (SESSION_ONLY.some((p) => under(pathname, p))) return false;
  if (under(pathname, "/api/auth")) return AUTH_WRITES.some((p) => under(pathname, p));
  return true;
}

export function readOnlyResponse() {
  return NextResponse.json(
    { error: READ_ONLY_MESSAGE },
    // The cutover takes well under an hour; clients may retry after that.
    { status: 503, headers: { "Retry-After": "3600" } },
  );
}

/** For the routes the middleware does not see (its matcher skips api/auth). */
export function refuseWhileReadOnly(req: Request) {
  return isReadOnlyMode() && blocksWhileReadOnly(req.method, new URL(req.url).pathname)
    ? readOnlyResponse()
    : null;
}
