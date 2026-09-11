# Monitoring

Runbooks for the observability pieces that live outside the codebase — the
kind of thing that requires a human with an account on a third-party service,
not a PR. See `docs/RELEASE.md` for what `/api/health` reports and how the
deploy pipeline itself uses it.

> **Note to reviewer:** if issue #74 (error monitoring / Sentry) lands a
> `docs/monitoring.md` of its own, merge that content with this file rather
> than keeping two — this section only covers uptime monitoring.

---

## Uptime monitoring (issue #75)

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

### What this does _not_ cover

- **Correctness/rendering** — `/api/health` proves the server answers and the
  database is reachable; it says nothing about whether pages render
  correctly. That's what the deploy pipeline's smoke-test step covers
  (`docs/RELEASE.md`, "Checking what is live"), on every deploy, not
  continuously.
- **Application errors in production** — this is availability monitoring,
  not error tracking. See issue #74 for that piece; if it has already added
  its own section to this file, treat that section as the source of truth for
  error monitoring and this section as the source of truth for uptime.
