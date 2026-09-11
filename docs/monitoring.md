# Monitoring

Runbooks and reference for the observability pieces added under the
Reliability epic (ATP Risk Report — "No Production Error Monitoring"):
error tracking (issue #74) and uptime monitoring (issue #75). See
`docs/RELEASE.md` for what `/api/health` reports and how the deploy
pipeline itself uses it.

## Error tracking (Sentry)

**Source:** GitHub issue #74, from the ATP Risk Report's Reliability finding
"No Production Error Monitoring" — before this, production errors were only
discovered via user reports or release-time smoke tests (`stack.md` recorded
"Error tracking: Not detected").

### What's wired up

`@sentry/nextjs` (`^10.74.0`) is installed and fully configured in code. It
integrates with the existing structured-error-logging path from issue #91
(`src/lib/errors.ts`, `src/lib/api-utils.ts`) rather than adding a second,
disconnected capture path:

- **`src/sentry.server.config.ts`** / **`src/sentry.edge.config.ts`** —
  `Sentry.init()` for the Node.js and Edge runtimes respectively. Both read
  the DSN from `SENTRY_DSN`. When it's unset, `enabled: false` makes the SDK
  a complete no-op (no network calls, nothing captured) — this is the state
  in local dev and CI today.
- **`src/instrumentation.ts`** — the Next.js server instrumentation entry
  point ([file convention
  docs](../node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md)).
  `register()` loads the right config above based on `NEXT_RUNTIME`.
  `onRequestError` (Next's hook for errors thrown during rendering — Server
  Components, Server Actions, and anything not already caught by an API
  route's own try/catch) forwards into `logError()` from `src/lib/errors.ts`,
  the same function every API route already uses.
- **`src/instrumentation-client.ts`** — client-side counterpart ([file
  convention
  docs](../node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md)).
  Reads `NEXT_PUBLIC_SENTRY_DSN`, same no-op-when-unset behavior, and exports
  `onRouterTransitionStart` so Sentry gets App Router navigation breadcrumbs.
- **`src/lib/errors.ts`** — `logError()` now calls `Sentry.captureException`
  for `severity: "unexpected"` errors only (in addition to its existing
  `console.error` JSON line). `"expected"` errors (`ValidationError`,
  `ForbiddenError`, `ConcurrentModificationError` — already mapped to a 4xx
  response by `handleApiError`) are deliberately **not** sent to Sentry: they
  aren't on-call-worthy, and sending them would burn the free tier's event
  quota on noise. Since every API route already calls `handleApiError` ->
  `logError`, every unhandled server error in the app is now reported to
  Sentry automatically, with no per-route changes needed.
- **`next.config.ts`** — wrapped with `withSentryConfig` (imported from
  `@sentry/nextjs/config`, per that version's deprecation notice) for source
  map upload. `sourcemaps.disable` is `!process.env.SENTRY_AUTH_TOKEN`, so
  **the build never requires Sentry credentials to succeed** — without
  `SENTRY_AUTH_TOKEN` (local dev, CI, or a Vercel deployment before the owner
  configures it) the plugin does no network I/O and the build behaves exactly
  as it did before Sentry was added. This was verified by running a full
  `npm run build` with no Sentry env vars set.
- **`.env.example`** — documents `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`,
  `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, all marked optional.

### Acceptance criteria status

- [x] `@sentry/nextjs` installed and configured — done in this PR.
- [x] CI / tests still pass — lint, typecheck, `vitest run` (145 tests),
      `npm run build` (no Sentry credentials), and `npm audit` were all run
      locally against this change with no new failures or advisories.
- [ ] **A test error is captured and visible in Sentry — not done, and not
      possible from this PR.** This repo has no Sentry account or DSN
      available to the environment this change was made in. The SDK is
      wired up so that once a real DSN is supplied, error capture works
      immediately with no further code changes — but confirming an event
      actually lands in a Sentry project requires a Sentry account, which
      only the repo owner can create.

### Manual steps for the repo owner (to close out the remaining criterion)

1. **Create a Sentry account and project** at <https://sentry.io> (the free
   Developer tier covers a project this size). Choose "Next.js" as the
   platform when prompted — this only affects Sentry's onboarding copy, not
   the code, since the SDK is already installed and configured.
2. **Get the DSN**: in the new project, go to Settings -> Client Keys (DSN)
   and copy the DSN value.
3. **Add environment variables in Vercel** (Project Settings -> Environment
   Variables), for Production (and Preview, if you want preview deployments
   monitored too):
   - `SENTRY_DSN` — the DSN from step 2.
   - `NEXT_PUBLIC_SENTRY_DSN` — the same DSN value (it's intentionally
     exposed to the client bundle; that's normal for a Sentry DSN, it's not
     a secret).
   - Optional, for readable stack traces instead of minified ones:
     `SENTRY_AUTH_TOKEN` (Settings -> Auth Tokens in Sentry, needs the
     `project:releases` scope), `SENTRY_ORG`, `SENTRY_PROJECT` (both visible
     in the project's Sentry URL).
4. **Redeploy** so the new environment variables take effect.
5. **Trigger a test error** and confirm it shows up in the Sentry dashboard.
   The simplest way: temporarily add a route that throws (e.g. hit an
   existing API route with intentionally malformed input to trigger an
   `unexpected`-severity error through `handleApiError`), or add a
   throwaway page that calls `throw new Error("Sentry test")` in a Server
   Component. Check the project's Issues stream in Sentry a few seconds
   later. Once confirmed, remove any throwaway test code.
6. Optionally configure Sentry's email alert rules (Settings -> Alerts) —
   the default "a new issue is created" rule already covers the "email
   alerts" part of the original ask, but is worth reviewing for noise
   tolerance.

## Uptime monitoring

**Source:** GitHub issue #75, from the same Reliability finding.

**Why:** release-time smoke tests (`.github/workflows/prod-deployment.yml`)
only check the app right after a deploy. Nothing currently notices if it goes
down between deploys. An external uptime monitor closes that gap by polling
`/api/health` continuously and alerting on failure.

### What the endpoint actually signals

`GET /api/health` (`src/app/api/health/route.ts`) returns two response
shapes, but only one status-code contract, which is what an uptime monitor
relies on:

| Condition                                                                                  | HTTP status | Body (unauthenticated)             |
| ------------------------------------------------------------------------------------------ | ----------- | ---------------------------------- |
| Database reachable                                                                         | **200**     | `{"status":"ok","time":"…"}`       |
| Database unreachable, or (for an authorized caller) a migration started and never finished | **503**     | `{"status":"degraded","time":"…"}` |

This is a correct signal for a naive "is this a 200?" monitor: the route
already returns `503`, not `200`, when it considers itself unhealthy (see the
`status === "ok" ? 200 : 503` branch at the end of the handler). No code
change was needed for this issue — see the PR for the check that confirmed
it. `src/app/api/health/route.test.ts` covers this status-code contract
directly (200/ok when the DB responds, 503/degraded when it throws or a
migration is stuck) so a future change to the handler that accidentally
flattens both cases to 200 fails CI instead of silently defeating the
monitor.

Do **not** point the monitor at the endpoint with an `Authorization: Bearer
$CRON_SECRET` header — that header unlocks the detailed body (version,
commit, migration names, config presence booleans), which is reconnaissance
material and has no reason to be handed to a third-party SaaS product. The
plain, unauthenticated request is the correct one for uptime monitoring, and
it's also the one that gives the clean 200/503 signal above.

### Recommended monitor: UptimeRobot (free tier)

UptimeRobot's free plan covers this: up to 50 monitors, 5-minute check
interval, unlimited email alerts, a public status page if wanted later. No
credit card required. This is the "Do" the issue names explicitly, and there
is no reason to reach for anything heavier for a single endpoint on a
solo-maintained project.

**Setup (~5 minutes):**

1. Create a free account at <https://uptimerobot.com> (or sign in if one
   already exists for this project).
2. **Add New Monitor**:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `ChickensFarm — production health`
   - **URL:** the app's production origin + `/api/health`, **no**
     `Authorization` header. The exact origin is the `APP_URL` repository
     variable under **Settings → Secrets and variables → Actions** (see
     `README.md`, "Daily reminders" section) — copy that value verbatim and
     append `/api/health`. Do not guess the domain; read it from the repo
     variable or the Vercel dashboard's Production deployment.
   - **Monitoring Interval:** 5 minutes (the free-tier minimum, and plenty
     for this app's traffic).
   - Leave **Expected status codes** / "up" criteria at UptimeRobot's default
     (2xx). No keyword/body matching is needed — the endpoint's status code
     alone is the correct signal, as shown above.
3. Under **Alert Contacts**, add the maintainer's email
   (mrazbadauskis@gmail.com) if it isn't already the account's own address,
   and attach it to this monitor. Optional: also add it to whatever channel
   is already used for `Actions → Status` failures, to keep alerts in one
   place.
4. Save the monitor. UptimeRobot immediately runs one check — confirm it
   shows **Up** with the 200 response before moving on.

### Verifying the alert fires (acceptance criterion: "simulate a failed health check")

Do this without touching production. Two options; either is sufficient —
pick whichever is faster in the UptimeRobot UI:

**Option A — point the monitor at a host that cannot answer.** Edit the
monitor's **URL** to something that is guaranteed to fail to connect, e.g.
`https://this-does-not-resolve.invalid/api/health`. This does not depend on
anything about this app's routing and cannot be confused with a real
incident.

> Do **not** use a made-up path on the _real_ production domain for this
> (e.g. `<APP_URL>/api/not-a-real-path`) — check `src/middleware.ts`'s
> `matcher` first: only `api/auth`, `api/cron`, and `api/health` (exact) are
> excluded from the auth redirect, so almost any other path, including one
> that doesn't exist, gets a **302 to `/login`** for an unauthenticated
> caller — which resolves as HTTP 200 once the monitor follows the redirect,
> not a failure. That would make this verification step silently pass
> without ever exercising the alert.

**Option B — switch the monitor type to "Keyword" temporarily.** Point it at
the real `<APP_URL>/api/health` (still unauthenticated) but require a
keyword that will never appear in the response, e.g. "this-keyword-is-
intentionally-absent". A keyword monitor reports Down when the keyword isn't
found, regardless of the HTTP status code — so this exercises UptimeRobot's
alert path without needing the app to actually be broken.

Either way:

1. Make the change above (Option A or B).
2. Either wait for the next scheduled check or use UptimeRobot's manual
   **Check now** action.
3. Confirm two things: the monitor's status flips to **Down**, and the alert
   email actually arrives at the configured address.
4. Revert the monitor back to type `HTTP(s)` / URL `<APP_URL>/api/health`
   with default (2xx) up-criteria, and confirm it returns to **Up** on the
   next check. **Do this before leaving it** — a monitor left pointed at a
   dead host or an impossible keyword is a monitor that will never tell you
   anything useful again.

### What uptime monitoring does _not_ cover

- **Correctness/rendering** — `/api/health` proves the server answers and the
  database is reachable; it says nothing about whether pages render
  correctly. That's what the deploy pipeline's smoke-test step covers
  (`docs/RELEASE.md`, "Checking what is live"), on every deploy, not
  continuously.
- **Application errors in production** — this is availability monitoring,
  not error tracking. See the "Error tracking (Sentry)" section above for
  that piece.
