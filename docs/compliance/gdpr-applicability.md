# GDPR applicability

**Status:** decided, 2026-09-09.
**Source:** ATP Risk Report → Compliance and Regulatory → *GDPR Compliance Gap*
(Focus 12.0 — Yellow, Risk score 12), tracked as
[issue #63](https://github.com/marraz1/ChickensFarm/issues/63).

> This is an engineering decision record, not legal advice. Nobody on this
> project is a lawyer. If the conclusion below ever needs to be relied on for
> a real compliance obligation (a regulator inquiry, a data subject request,
> a contract with a third party), get it checked by someone qualified.

## The question

GDPR obligations differ depending on who actually uses the app. A tool one
person builds and runs solely for their own farm's records sits in a much
lighter compliance position than a service that processes other people's
personal data on their behalf. The question this doc settles: which of those
is ChickensFarm, today, as deployed?

## What the code actually supports

- **Registration is public and unrestricted.** `/register`
  (`src/app/(auth)/register/page.tsx`) is listed as a public path in
  `src/middleware.ts`, and `POST /api/auth/register`
  (`src/app/api/auth/register/route.ts` →
  `registerUser` in `src/lib/services/auth.ts`) creates a `User` row for
  anyone who supplies a unique e-mail and password. There is no allowlist,
  invite token, or environment flag gating who can sign up — the only limit
  is a per-IP rate cap (8/15min) aimed at bulk-signup abuse, not at
  restricting the user base.
- **Each user gets their own isolated farm.** `createFarm`
  (`src/lib/services/farms.ts`) creates a `Farm` and a single `FarmUser` row
  with `role: "OWNER"` for the creating user. Every service query is scoped
  by `farmId` via `requireFarmAccess`/`requireFarmAccessApi`
  (`src/lib/session.ts`), and `docs/security-review.md` plus
  `src/lib/services/multi-tenant-isolation.test.ts` (38 tests) confirm one
  account's data is never reachable from another's session.
- **Multi-user collaboration on one farm is modeled but not reachable.**
  `prisma/schema.prisma` defines `FarmRole { OWNER WORKER }` and lets a
  `Farm` have many `FarmUser` rows, but grepping `src/` turns up no invite
  flow, no "add member" endpoint, and no other code path that ever creates a
  `FarmUser` with `role: "WORKER"` — `createFarm` is the only place a
  `FarmUser` row is ever created, and it always uses `OWNER` for the farm's
  creator. So today, sharing one farm's data between two people isn't
  something the app can do yet, even though the schema anticipates it.

## What this means for GDPR

The issue's premise — "sole-trader personal use may be treated more lightly,
but any third-party users trigger full obligations" — turns on **whether
anyone besides the builder uses the service to process personal data**, not
on whether users share data with each other inside the app. Those are
separate questions, and the code answers them differently:

- Multi-user-*per-farm* collaboration: not currently possible (see above).
  If it's built later, it doesn't change the conclusion below — it was
  already the deciding factor once registration went public.
- Third-party use of the *service*: already possible, and already the
  default posture, because registration is open to anyone. The moment a
  person who is not the builder creates an account, the builder is
  processing that person's personal data (their e-mail, password hash, and
  whatever farm/financial records they enter — which can itself include
  other people's names, e.g. `EggSale.buyer`, `BirdTransaction.counterparty`)
  through a service the builder operates. That makes the builder a data
  controller for that account under GDPR, regardless of how many farms exist
  or whether those farms are ever shared.

## Conclusion

**Full GDPR obligations apply to ChickensFarm as currently deployed.** The
app is not, in practice, sole-trader personal use only: registration is
public, so third-party users are not a hypothetical future state — they are
one signup away at all times, and the deployment must be treated as if they
already exist. This isn't conditional on the (currently unbuilt) multi-user
farm-sharing feature.

The lighter "sole-trader personal use" posture the issue describes would
only hold if the deployment were restricted so that only the builder could
ever have an account (e.g., registration disabled or gated behind a
builder-only allowlist). That is not how the app is built or run today, and
this doc does not recommend changing that — it recommends treating the app
as in-scope and acting accordingly (privacy notice, documented processor
agreements with Neon/Vercel/Resend, a way to honor data subject requests).

## Revisit if

- Registration is ever restricted to a closed allowlist and no third-party
  accounts exist or are expected — the sole-trader framing would then need
  re-evaluating.
- A farm-sharing/invite feature is built (making the `WORKER` role
  reachable) — this would not change the applicability conclusion (see
  above) but would add a new personal-data-sharing relationship worth its
  own review (e.g. what a `WORKER` can see about the `OWNER` and vice versa).
