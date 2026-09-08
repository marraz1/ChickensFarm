# OWASP API Security Top 10 (2023) — Self-Review

**Date:** 2026-09-08
**Scope:** All 35 route handlers under `src/app/api/**/route.ts`, plus the shared
infrastructure they depend on: `src/lib/session.ts` (auth guards), `src/lib/errors.ts`
and `src/lib/api-utils.ts` (`handleApiError`), `src/lib/validation/*` (zod schemas),
`src/lib/auth.ts` / `src/lib/auth.config.ts` (NextAuth v5 beta), `src/middleware.ts`,
`next.config.ts`, and `prisma/schema.prisma`.

**Context:** [PR #134](https://github.com/marraz1/ChickensFarm/pull/134) added
`src/lib/services/multi-tenant-isolation.test.ts`, a 38-test integration suite (run
against an in-memory fake Prisma client) that verifies, at the service layer, that a
member of Farm B can never read, list, update, delete, or cross-link a resource
belonging to Farm A. That suite already gives strong, automated evidence for **API1**
at the layer where the actual tenant-scoping logic lives. This review does not
re-litigate that coverage; instead it checks the layer PR #134 doesn't touch — every
route handler's use of the guards, request-body validation, and the other nine OWASP
categories.

**Method:** every one of the 35 `route.ts` files was read in full, along with the
service functions and validation schemas they call, `git blame`-adjacent reasoning
from code comments, and the repository's own documented convention in
`.coderabbit.yaml` (every `route.ts` must open with `requireActiveFarmApi()`,
`requireFarmAccessApi()`, or `requireUserApi()`, validate its body with zod, delegate
to `src/lib/services`, and wrap the body in try/catch → `handleApiError`). All 35
routes were checked against that convention by direct reading, not by search.

## Summary

| # | Category | Verdict |
|---|----------|---------|
| API1 | Broken Object Level Authorization | Clean |
| API2 | Broken Authentication | **Finding (High)** |
| API3 | Broken Object Property Level Authorization | Clean |
| API4 | Unrestricted Resource Consumption | **Finding (Medium)** — same root cause as API2 |
| API5 | Broken Function Level Authorization | Clean |
| API6 | Unrestricted Access to Sensitive Business Flows | **Finding (Medium)** |
| API7 | Server Side Request Forgery | **Finding (Medium)** |
| API8 | Security Misconfiguration | Minor note |
| API9 | Improper Inventory Management | Clean |
| API10 | Unsafe Consumption of APIs | Clean |

---

## API1: Broken Object Level Authorization

**Checked:** All 35 route handlers, cross-referenced against the guard convention in
`.coderabbit.yaml` and the cross-farm assertions in PR #134.

Every route that touches a farm-scoped resource opens with `requireActiveFarmApi()`
or `requireFarmAccessApi(farmId)` before doing anything else, and every one of them
passes the resulting `farm.id` — never a client-supplied `farmId` — into its service
function. No route queries `prisma` directly; all 35 delegate to `src/lib/services/*`.
Spot-checked service implementations (`egg-collections.ts`, `bird-groups.ts`,
`farms.ts`) confirm the pattern PR #134's tests exercise: mutations by id first run
`findFirst({ where: { id, farmId } })` and throw if it returns null before the actual
update/delete, and cross-links (e.g. attaching a `birdGroupId` to an egg collection)
are verified against the same farm before being written.

`/api/farms/[farmId]` is the one route that takes `farmId` from the URL for a
different farm than the caller's active one — `requireFarmAccessApi(farmId)` re-checks
membership against that specific id on every call, which is exactly the boundary
PR #134's "Farm membership boundary" test group exercises directly.

**Verdict: Clean.** No route bypasses the service layer or the guard convention.

## API2: Broken Authentication

**Checked:** `src/lib/auth.ts`, `src/lib/auth.config.ts`, `src/middleware.ts`,
`src/lib/services/auth.ts`, `src/lib/validation/auth.ts`, and the three
`api/auth/*` routes.

Positives:
- Sessions use NextAuth v5 (JWT strategy); the Edge-safe `auth.config.ts` is shared
  between `middleware.ts` and the full config, so route protection and session
  validation use one source of truth.
- Passwords are hashed with bcrypt at cost 12 (`src/lib/services/auth.ts`).
- Password reset tokens are single-use (`usedAt`), expire after 1 hour, are stored
  only as a SHA-256 hash (`tokenHash`), and are generated with 32 bytes from
  `crypto.randomBytes` — good, unguessable, non-replayable tokens.
- The password-reset request endpoint always returns `{ ok: true }` regardless of
  whether the email exists, deliberately avoiding account-enumeration via response
  shape (`requestPasswordReset` in `src/lib/services/auth.ts`).
- `middleware.ts` correctly excludes only `api/auth`, `api/cron`, and `api/health`
  from the session check, with a documented rationale for each.

**Finding (High): no rate limiting or brute-force protection on any authentication
endpoint.** Login (the NextAuth Credentials provider), `POST /api/auth/register`, and
`POST /api/auth/password-reset` (request side) have no attempt throttling, lockout, or
CAPTCHA anywhere in the codebase — confirmed by grepping the whole `src/` tree for
`rate` / `ratelimit` (no matches outside comments) and by there being no
`vercel.json` or middleware-level throttling. Nothing in `next.config.ts` or
`middleware.ts` limits request rate either. This means:
  - Credential stuffing / password brute-forcing against `/api/auth/callback/credentials`
    is unthrottled.
  - `POST /api/auth/password-reset` can be hit repeatedly for an arbitrary target
    email, which — since the endpoint always sends the reset email when the account
    exists — becomes an email-bombing vector against a victim's inbox.
  - `POST /api/auth/register` can be scripted to create accounts in bulk (see API6).

Minor note: `registerSchema.password` requires only 8 characters with no complexity
rule (`src/lib/validation/auth.ts`). Acceptable under modern length-over-complexity
guidance (NIST 800-63B), but 8 is on the low end; not filed as a separate issue.

**Verdict: Finding.** Filed as a follow-up issue (see below).

## API3: Broken Object Property Level Authorization

**Checked:** All 14 files in `src/lib/validation/*`, and how each route/service
consumes `parsed.data`.

Every zod schema in `src/lib/validation` explicitly enumerates its accepted fields;
none of them include `farmId`, `id`, `userId`, `ownerId`, or `role` (verified by
grepping the validation directory for those field names — zero matches). Every route
handler passes `parsed.data` — the validated, whitelisted object — into its service
function rather than spreading the raw request body, and every service function that
writes to Prisma builds its `data:` object field-by-field rather than spreading
`input`. `farmId` is always the value returned by the session guard, never a value
read from the request body. There is no mass-assignment path from client input to a
sensitive column.

**Verdict: Clean.**

## API4: Unrestricted Resource Consumption

**Checked:** All 35 routes for pagination/limits, plus `cron/reminders` and
`blob/upload` specifically as flagged in the review scope.

- `blob/upload` is well-bounded: it requires an authenticated user with an active
  farm, restricts `allowedContentTypes` to four image types, and caps
  `maximumSizeInBytes` at 10 MB.
- `cron/reminders` requires a constant-time-compared `CRON_SECRET` bearer token
  (`timingSafeEqual`, closed when unconfigured) and is excluded from the session
  middleware for a documented reason; `maxDuration = 60` bounds its own runtime.
- List endpoints (`GET /api/egg-collections`, `/api/bird-groups`, etc.) return a
  farm's full history with no pagination. This is low severity in practice — the data
  is bounded by one tenant's own record volume, not attacker-controlled — but is
  worth keeping in mind as farms accumulate years of daily entries. Not filed as a
  separate issue; noted here for future reference.
- No route enforces a request body size limit beyond what Next.js defaults to.

**Finding (Medium): same root cause as API2** — the absence of any rate limiting
means `POST /api/auth/register`, `POST /api/auth/password-reset`, and
`POST /api/notifications/test` (see API6) can all be called at unlimited frequency,
which is a resource-consumption problem as much as an authentication one. Tracked
under the same follow-up issue as API2 rather than a duplicate.

**Verdict: Finding**, covered by the API2 follow-up issue.

## API5: Broken Function Level Authorization

**Checked:** every route for elevated/admin-only actions.

The only privilege-gated action in the app is farm ownership: `PATCH` and `DELETE`
on `/api/farms/[farmId]` both call `requireFarmAccessApi(farmId, { minRole: "OWNER"
})`, correctly requiring not just "logged in" but "logged in AND an OWNER of this
specific farm" — `GET` on the same route only requires membership, which is the
correct, narrower check for a read. There is currently no farm-invite or
role-assignment endpoint in the API surface (`FarmUser.role` is only ever set to
`OWNER`, at farm creation, in `src/lib/services/farms.ts`), so there is no
elevation-of-privilege surface to check beyond this.

**Verdict: Clean.**

## API6: Unrestricted Access to Sensitive Business Flows

**Checked:** farm creation, registration, and `POST /api/notifications/test`
specifically (flagged in the review scope as worth a specific look).

Farm creation and registration have no per-account cap and no rate limiting (see
API2), so scripted bulk account/farm creation is possible, but the impact is mostly
storage/noise rather than a direct attack — there's no invite flow, payment flow, or
inventory-scarce resource being farmed.

**Finding (Medium): `POST /api/notifications/test` lets any authenticated user send
an email, with attacker-chosen message content, to any email address — not just
their own account's address.** Reading `src/lib/validation/notifications.ts`, the
`email` field of `notificationTestSchema` is validated only as "a well-formed email
address, ≤254 chars, optional" — there is no check that it belongs to the caller. The
route (`src/app/api/notifications/test/route.ts`) then calls
`sendReminderEmail(recipient, message)`, which sends via the app's own Resend
account and `EMAIL_FROM` address. Combined with the lack of any rate limiting, an
authenticated (but otherwise unprivileged) user can use this endpoint as a
send-anything-to-anyone relay: up to 300 characters of arbitrary text, sent
repeatedly, from the app's sending domain — a spam/phishing and sender-reputation
risk, and a way to burn through the Resend quota. This is a real, actionable
business-logic gap: a "send test notification" feature should only ever be able to
message the account's own address (or its already-configured notification email),
never an arbitrary third party.

**Verdict: Finding.** Filed as a follow-up issue (see below).

## API7: Server Side Request Forgery

**Checked:** every route for client-supplied URLs that the server later fetches;
`blob/upload` specifically, and any endpoint accepting a URL.

`blob/upload` does not fetch a client-supplied URL — it hands back a signed token for
the *browser* to upload directly to Vercel Blob, which is the safe direction. No
route accepts a webhook-config URL or an "image URL" to fetch server-side.

**Finding (Medium): `POST /api/push/subscribe` accepts an arbitrary,
un-allowlisted URL as the push `endpoint`, which the server later uses to make an
outbound HTTP request.** `pushSubscriptionSchema` in `src/lib/validation/push.ts`
validates `endpoint` only as `z.string().url()` — any syntactically valid URL is
accepted and stored (`src/lib/services/push-subscriptions.ts`). That stored value is
later passed straight into `webpush.sendNotification({ endpoint: sub.endpoint, ... },
body)` in `src/lib/push.ts`, both from the (self-service, unthrottled — see API6)
`/api/notifications/test` route and from the daily cron reminder batch. This means an
authenticated user can register a "subscription" whose `endpoint` points anywhere —
an internal service address, a metadata endpoint, or an attacker-controlled
listener — and trigger the server to make an HTTP POST to it on demand, via their own
test-notification call. The payload body is VAPID-encrypted ciphertext (not directly
readable/steerable plaintext), but the request itself — destination host, timing, and
the fact that a request was made at all — is fully attacker-controlled, which is the
core of an SSRF issue: legitimate push-service endpoints come from a small, known set
of hosts (`fcm.googleapis.com`, `updates.push.services.mozilla.com`,
`*.push.apple.com`, etc.) and nothing here restricts to that set.

**Verdict: Finding.** Filed as a follow-up issue (see below).

## API8: Security Misconfiguration

**Checked:** `next.config.ts`, `src/middleware.ts`, CORS configuration,
`handleApiError` behavior, and `api/notifications/test` reachability specifically
(flagged in scope).

- No CORS headers are set anywhere in the app, which is the safe default for a
  same-origin app with no public API consumers — not a finding.
- `handleApiError` (`src/lib/api-utils.ts`) maps known domain errors
  (`ForbiddenError` → 403, `ValidationError` → 400, `ConcurrentModificationError` →
  409) to clean JSON messages and re-throws anything else, which Next.js turns into
  its standard production 500 response — no stack traces or internal details are
  returned to the client for unexpected errors.
- `api/notifications/test` is reachable in production, but that's by design (it's the
  "send test notification" button in the notification-settings form,
  `src/components/forms/notification-settings-form.tsx`), and it is gated by
  `requireUserApi()` like any other authenticated route — it is not an
  unauthenticated debug endpoint. Its actual problem is the business-logic one
  described under API6, not exposure.
- `health` intentionally serves two response shapes (minimal for anonymous callers,
  detailed for holders of `CRON_SECRET`) with a clearly documented rationale for
  never leaking secret values, migration names, or error text to an unauthenticated
  caller. Well-designed.

**Minor note:** `next.config.ts`'s `headers()` sets `Cache-Control` for `/sw.js` only
— there is no baseline security-header set (`Content-Security-Policy`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Strict-Transport-Security`,
`X-Frame-Options`/`frame-ancestors`). None of these are exploitable on their own
given the app has no user-generated HTML rendering and no known XSS vector found in
this review, but their absence removes a defense-in-depth layer against exactly that
class of bug if one is introduced later. Low severity, not filed as its own issue —
noted here as a cheap, low-risk hardening opportunity for a future pass.

**Verdict: Minor note only**, no follow-up issue filed (the one concrete misconfiguration
concern — `notifications/test` — is really the API6 finding above, already filed).

## API9: Improper Inventory Management

**Checked:** enumerated all 35 `route.ts` files against what's actually linked from
the UI / used by cron.

Every route traces to an intentional caller: 27 are called from `fetch()` calls in
`src/components/forms/*` or page components, `auth/[...nextauth]` is NextAuth's own
handler, `cron/reminders` and `health` are called by the GitHub Actions scheduled
workflow / external monitor (excluded from session middleware on purpose, both with
documented rationale), and `active-farm`/`push/subscribe`/`notification-settings`/
`notifications/test` are all wired to specific UI components. No orphaned, duplicate,
or clearly-forgotten route was found — there is no old `/api/v1/`-style surface, no
route left over from a removed feature, and no handler with a name suggesting it's
scaffolding or a leftover debug tool.

**Verdict: Clean.**

## API10: Unsafe Consumption of APIs

**Checked:** every third-party API integration — Resend (`src/lib/email.ts`),
web-push (`src/lib/push.ts`), and Vercel Blob (`api/blob/upload`).

- Resend: the SDK's `{ data, error }` result is checked explicitly (`sendEmail`
  throws on `error`); nothing from the response is deserialized into a trusted
  structure or executed. `describeSendError` in `api/notifications/test/route.ts`
  truncates and sanitizes the provider's error message before it reaches the client
  (length-capped, prefix-stripped), which is careful handling of untrusted
  third-party text.
- web-push: response status codes are checked narrowly (`isGoneStatus` for
  404/410) before deleting a subscription row; nothing else from the push service's
  response is trusted or acted on beyond that.
- Vercel Blob: `handleUpload` from `@vercel/blob/client` is used as documented,
  with content-type and size restricted in `onBeforeGenerateToken`; the completed
  upload's URL is only persisted when the *user's own form* is submitted, not from
  the `onUploadCompleted` callback — so a Blob response cannot itself trigger a write
  through this route beyond what the client already validated.

No third-party response data is deserialized unsafely, used in a template without
escaping (the app's own HTML templates escape user-controlled data via
`src/lib/html.ts`'s `escapeHtml`/`escapeHtmlWithBreaks`, including reset links and
reminder messages), or trusted for authorization decisions.

**Verdict: Clean.**

---

## Follow-up issues filed

| Issue | Category | Severity | Title |
|-------|----------|----------|-------|
| [#135](https://github.com/marraz1/ChickensFarm/issues/135) | API2 / API4 | High | Add rate limiting / brute-force protection to auth endpoints |
| [#136](https://github.com/marraz1/ChickensFarm/issues/136) | API6 | Medium | Restrict `/api/notifications/test` to the caller's own address |
| [#137](https://github.com/marraz1/ChickensFarm/issues/137) | API7 | Medium | Allowlist push subscription endpoint hosts to prevent SSRF |

All three are filed as sub-issues of #82.

## Acceptance criteria

- [x] Self-review of API route handlers completed against OWASP API Top 10
- [x] CI / tests still pass (verified locally: `npm run lint`, `npm run typecheck`,
      `npm test`)
- [x] Findings documented (this file) and follow-up issues filed for anything found
