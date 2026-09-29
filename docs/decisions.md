# Decisions log

Short, dated entries recording a choice that was deliberately made — and why —
so it doesn't get re-litigated from scratch later. Not a design doc; each
entry is a paragraph or two. Newest entries go at the bottom.

## Format

Each entry is a `##` heading of the form `YYYY-MM-DD — <decision>: <outcome>`
(outcome is e.g. _adopted_, _not adopted_, _removed_), followed by:

- **Context:** what prompted the decision — the problem, the report finding,
  the incident.
- **Alternatives:** the options that were considered (including "do nothing").
- **Decision:** what was chosen and the main reason.
- **Consequences:** what changes as a result, costs accepted, follow-ups.
- **Revisit if:** _(optional)_ the signal that should reopen the question.

Link the PR and/or issue where the decision was made. The date is when the
decision was made (usually the merge or close date). Only record what
actually happened; if a reason was never written down, say so rather than
guessing. The two oldest-written entries (Snyk, co-reviewer) use slightly
different labels (_Considered_ / _Decided_); they carry the same information.

Release-by-release changes are not tracked here: every production release is
a `vX.Y.Z` tag plus a `chore(release)` commit created by the PROD_deployment
workflow (see [`RELEASE.md`](RELEASE.md)), so e.g.
`git log v0.1.10..v0.1.11` is the changelog for a release.

---

## 2026-07-02 — Stack: Next.js on Vercel, Neon Postgres via Prisma: adopted

**Context:** The app was built from scratch from the requirements spec
(`Paukstininkyste_reikalavimu_specifikacija.md`) as a mobile-first web app.
The plan's "Confirmed decisions" are in
[`implementation-plan.md`](implementation-plan.md), alongside the
architecture diagram `sistemos_architektura.png` (Vercel + Neon).

**Alternatives:** Not recorded — the stack was fixed in the plan before the
first commit.

**Decision:** Next.js App Router + TypeScript (16.2.10 at the first commit,
`b67883f`; 16.3.4 today), Tailwind + shadcn/ui, Prisma with the Neon
serverless driver adapter, Auth.js (NextAuth v5) with the Credentials
provider and JWT sessions, Vercel Blob for photos and Resend for email.
Smaller choices are in the plan's cross-cutting decisions table: `cuid()` IDs
(no PK collisions across Neon branches), `Decimal(10,2)` for money, and
`bcryptjs` instead of native `bcrypt` (which can fail to build on Vercel).

**Consequences:** Hosting and database are free-tier serverless services,
which shapes later decisions (see the reminders entry below). This Next.js
version has breaking changes relative to older docs and model training data,
so [`AGENTS.md`](../AGENTS.md) tells contributors and AI assistants to read
the bundled docs in `node_modules/next/dist/docs/` before writing code. The
as-built system is described in [`architecture.md`](architecture.md).

---

## 2026-08-24 — Daily reminders on a GitHub Actions schedule, not Vercel Cron: adopted

**Context:** Daily "enter your data" reminders
([PR #12](https://github.com/marraz1/ChickensFarm/pull/12), then web push in
[PR #15](https://github.com/marraz1/ChickensFarm/pull/15)) need a scheduler.
The implementation plan had assumed Vercel Cron.

**Alternatives:** Vercel Cron; a GitHub Actions `schedule` workflow calling
`POST /api/cron/reminders` with a shared `CRON_SECRET`.

**Decision:** GitHub Actions (`.github/workflows/reminders.yml`, every 15
minutes), because Vercel Cron on the free Hobby plan runs only once per day
([PR #12](https://github.com/marraz1/ChickensFarm/pull/12),
[PR #29](https://github.com/marraz1/ChickensFarm/pull/29)).

**Consequences:** GitHub only runs scheduled workflows from the default
branch, which is one reason `main` stays the default branch in the release
model ([PR #25](https://github.com/marraz1/ChickensFarm/pull/25)). GitHub
also throttles schedules heavily — over 62 h it delivered 12% of the
requested ticks, with gaps of up to 11.3 h — so
[PR #29](https://github.com/marraz1/ChickensFarm/pull/29) (2026-08-28)
dropped the 240-minute send window: a reminder is now due from its time until
local midnight, however late the tick arrives.

---

## 2026-08-25 — Versioned production releases from a `release` branch: adopted

**Context:** Vercel deployed whatever landed on `main`; nothing carried a
version, there were no tags, and confirming a deploy meant checking three
places ([PR #25](https://github.com/marraz1/ChickensFarm/pull/25)).

**Alternatives:** Keep auto-deploying `main` to production.

**Decision:** Production deploys from `release`, which only the manual
PROD_deployment workflow writes to (preflight, version bump + tag, build,
verify via `/api/health`, summary). `main` stays the default branch so
scheduled workflows keep running. The quality gates were added to the
pipeline in [PR #26](https://github.com/marraz1/ChickensFarm/pull/26).

**Consequences:** Every release is a `vX.Y.Z` tag, and `/api/health` and the
profile screen show the running version. Details in
[`RELEASE.md`](RELEASE.md).

---

## 2026-09-08 — Snyk for dependency scanning: not adopted

**Status:** Decided in
[PR #122](https://github.com/marraz1/ChickensFarm/pull/122).

**Considered:** Adding Snyk (Open Source scanning) on top of the two scanners
already in place — the `audit` job in `.github/workflows/ci.yml`
(`npm audit --audit-level=high`, gated through
`.github/scripts/check-npm-audit.mjs`'s documented exception list) and
GitHub's native Dependabot (`.github/dependabot.yml` weekly update PRs, plus
Dependabot security alerts enabled on the repo).

**Decided:** Not now. Snyk's marginal value over the current setup is real but
small here: its vulnerability database is broader and often faster to publish
than npm's advisory feed, and its remediation suggestions (targeted patches,
not just "bump to latest") are more precise than a Dependabot PR. But this app
has no container or IaC surface for Snyk's other scanners to cover, license
scanning isn't a current need, and Dependabot's weekly PRs already deliver
working remediation (an open PR with the fixed version) for the CVEs most
likely to matter. Against that, Snyk adds a third account to maintain, a
`SNYK_TOKEN` secret to provision and rotate, and a second exception list to
keep in sync with the one `check-npm-audit.mjs` already maintains — real
ongoing cost for a solo-maintained, free-tier project. The two scanners
already in CI catch the CVEs that matter and fail the build on anything new
and unaccepted; that's the bar this task needs to clear, not "every possible
signal."

**Revisit if:** the dependency tree grows a container/IaC component Snyk
would meaningfully cover, license-compliance scanning becomes a requirement,
or the current `npm audit` + Dependabot combination visibly misses a CVE that
Snyk would have caught.

---

## 2026-09-08 — Hold eslint 10 and TypeScript 7 major bumps: adopted

**Context:** Two Dependabot PRs
([PR #112](https://github.com/marraz1/ChickensFarm/pull/112), eslint 9 to
10, and [PR #115](https://github.com/marraz1/ChickensFarm/pull/115),
typescript 5.9 to 7.0) merged the same day and broke `npm run lint` on
`main`, blocking every open PR.

**Alternatives:** Fix forward, or revert to exactly the old versions.

**Decision:** [PR #123](https://github.com/marraz1/ChickensFarm/pull/123)
pinned eslint to `^9.39.5` and TypeScript to `6.0.3` (the newest version
supported by `typescript-eslint`, which `eslint-config-next` bundles), and
added Dependabot `ignore` rules for major bumps of both.

**Consequences:** Major bumps of these two packages no longer arrive
automatically.

**Revisit if:** `eslint-config-next` ships support for eslint 10 or newer
TypeScript. Then remove the `ignore` rules in `.github/dependabot.yml`.

---

## 2026-09-10 — Full GDPR obligations apply: accepted

**Context:** It was open whether the app counts as "sole-trader personal
use" or as a service processing third parties' data
([#63](https://github.com/marraz1/ChickensFarm/issues/63)).

**Decision:** Full obligations apply, because `/register` is public and
unrestricted, so anyone can sign up
([PR #145](https://github.com/marraz1/ChickensFarm/pull/145)). The reasoning
is in [`compliance/gdpr-applicability.md`](compliance/gdpr-applicability.md)
(an engineering record, not legal advice).

**Consequences:** A public privacy notice
([PR #144](https://github.com/marraz1/ChickensFarm/pull/144),
[PR #146](https://github.com/marraz1/ChickensFarm/pull/146)), required
registration consent, and DPA tracking for Vercel, Neon and Resend in
[`compliance.md`](compliance.md)
([PR #143](https://github.com/marraz1/ChickensFarm/pull/143),
[PR #147](https://github.com/marraz1/ChickensFarm/pull/147)).

---

## 2026-09-15 — Occasional human co-reviewer for high-risk changes: adopted

**Status:** Accepted 2026-09-15
([PR #151](https://github.com/marraz1/ChickensFarm/pull/151), issue
[#73](https://github.com/marraz1/ChickensFarm/issues/73)). No co-reviewer has been
named yet.

**Context:** All knowledge of the codebase sits with one maintainer. Review
today is CI gates plus the maintainer's own pass over `REVIEW.md`, sometimes
with an AI assistant (a CodeRabbit config existed but the app was never
installed, and it was removed because it has no free plan). The
2026-09-07 risk evaluation rates "Solo Maintainer Knowledge Concentration" as
the top maintainability risk (focus 12.0) and notes there is no human peer
review at all. AI review is good at pattern violations it has been told about
(a missing guard, a query without `farmId`); it is weaker at the questions a
person who knows the domain asks — "is this the number a farmer expects?",
"what happens to existing rows?", "why is this route public?".

**Considered:**

1. _Self-review plus ad-hoc AI review (status quo)._ Zero cost, never blocks. Leaves the blind
   spots above, and nobody else ever sees the riskiest code.
2. _An occasional human co-reviewer for flagged high-risk changes only._ One
   friend or colleague, asked asynchronously when a PR touches auth, tenant
   scoping, money, migrations, secrets/outbound I/O, CI/release, or a major
   dependency upgrade. A few requests a month at most; never blocking.
3. _Mandatory human review for every PR (branch protection)._ The strongest
   signal, but it makes a solo project's velocity depend on a volunteer's free
   time and would block urgent fixes. Disproportionate here.

**Decided:** Option 2, as written up in
[`review-process.md`](review-process.md): a path-based definition of
high-risk, a `needs-human-review` label plus a PR-template checkbox, a
~3-day turnaround, and — when nobody is available — merge anyway with a note
in the PR and a self-review checklist. Branch protection is not changed.

**Consequences:** The riskiest changes get a second pair of human eyes
without slowing everything else down, and a second person gradually gains
some familiarity with the code. Costs: finding and keeping one willing
reviewer, a little extra PR-description writing, and the discipline to
actually flag PRs (the template checkbox is the reminder). Nothing is
enforced, so the process only works if it is used; unreviewed high-risk
merges stay visible through the label.

**Revisit if:** no reviewer is found within a couple of months (fall back to
option 1 and drop the label), the project gains a second regular contributor
(move toward option 3), or a high-risk PR that skipped co-review causes an
incident.

---

## 2026-09-15 — CodeRabbit AI review: removed

**Context:** A `.coderabbit.yaml` existed, but the CodeRabbit app was never
installed: none of the previous 60 PRs got a CodeRabbit review
([PR #153](https://github.com/marraz1/ChickensFarm/pull/153),
[#154](https://github.com/marraz1/ChickensFarm/issues/154)).

**Alternatives:** Install and pay for CodeRabbit, or remove the config.

**Decision:** Removed, because CodeRabbit has no free plan.
[`REVIEW.md`](../REVIEW.md) stays as the checklist for self-review, ad-hoc
AI-assisted review and the human co-review above.

**Consequences:** No automated AI reviewer runs on PRs. Human review of risky
changes is covered by the co-reviewer process, not by a bot.

---

## 2026-09-29 — GitHub CodeQL (SAST): not adopted

**Context:** The 2026-09-07 risk report flagged "No SAST or Security Review"
and suggested enabling CodeQL
([#81](https://github.com/marraz1/ChickensFarm/issues/81)).

**Alternatives:** Enable CodeQL code scanning, or go without a SAST tool.

**Decision:** Won't do (closed as not planned on 2026-09-29). GitHub CodeQL
code scanning is free only for public repositories, and this repository is
private.

**Consequences:** No SAST tool runs in CI. Security coverage comes from the
OWASP API Top 10 self-review ([`security-review.md`](security-review.md),
[PR #138](https://github.com/marraz1/ChickensFarm/pull/138)), the
multi-tenant isolation suite
([PR #134](https://github.com/marraz1/ChickensFarm/pull/134)), the
`npm audit` gate ([PR #106](https://github.com/marraz1/ChickensFarm/pull/106))
and Dependabot ([PR #111](https://github.com/marraz1/ChickensFarm/pull/111)).

**Revisit if:** the repository becomes public, or a free SAST option for
private repositories turns up.

---

## 2026-09-29 — Playwright smoke E2E against the Vercel preview: adopted

**Context:** No end-to-end tests existed, so core user journeys were never
tested in a real browser
([#95](https://github.com/marraz1/ChickensFarm/issues/95)).

**Decision:** [PR #160](https://github.com/marraz1/ChickensFarm/pull/160)
added `@playwright/test` and `e2e/smoke.spec.ts` (the login page renders,
signed-out `/` redirects to login, `/privacy` is public; no database or
seeded user needed). A CI `e2e` job runs it against the preview URL after the
`preview` job succeeds. If a `VERCEL_AUTOMATION_BYPASS_SECRET` secret exists,
it is sent as `x-vercel-protection-bypass`. If Deployment Protection still
blocks the preview (401/403, or a 302 to `vercel.com/login`, which commit
`afb16f2` added), the job warns and skips instead of failing.

**Consequences:** A failed E2E run fails the `CI` gate; a skipped one does
not. So until the preview is reachable (bypass secret set, or protection
off), the smoke test guards nothing. See [`testing.md`](testing.md).

---

## 2026-09-29 — Remove `--passWithNoTests` from the test script: adopted

**Context:** `vitest run --passWithNoTests` meant the test gate stayed green
even if every test file was deleted
([#71](https://github.com/marraz1/ChickensFarm/issues/71)).

**Decision:** [PR #162](https://github.com/marraz1/ChickensFarm/pull/162)
changed the `test` script to `vitest run`. CI and PROD_deployment both call
`npm test`, so no workflow edits were needed. The PR verified locally that
`npm test` exits 1 when no test files are found.

**Consequences:** The Test gate can now fail where it used to pass
vacuously, so a PR that removes all tests cannot go green.
