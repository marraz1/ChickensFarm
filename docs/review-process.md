# Review process

> Adopted 2026-09-15 — see the entry in [`decisions.md`](decisions.md) for why.

Every pull request into `main` already gets CI (`.github/workflows/ci.yml`) and
a self-review against [`REVIEW.md`](../REVIEW.md). That is enough for most
changes. For the small set of changes where a mistake leaks one farm's data,
corrupts money figures, or cannot be rolled back, we additionally ask **one
human co-reviewer** to look — occasionally, asynchronously, and without ever
blocking a fix.

---

## What counts as high-risk

A PR is high-risk if it **changes behaviour** in one of the areas below. A
comment, copy or formatting change inside these paths is not. When in doubt,
flag it — the cost of a false positive is one extra review request.

| Area                          | Paths                                                                                                                                                                                                                                                                 | What could go wrong                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Auth and session**          | `src/lib/auth.ts`, `src/lib/auth.config.ts`, `src/lib/session.ts`, `src/middleware.ts`, `src/lib/rate-limit.ts`, `src/lib/services/auth.ts`, `src/lib/validation/auth.ts`, `src/app/api/auth/**`                                                                      | Account takeover, a route left public, broken password reset                     |
| **Tenant (farm) scoping**     | A new or changed query in `src/lib/services/**`; a new `src/app/api/**/route.ts` or a changed guard in one; `src/lib/services/farms.ts`, `src/app/api/farms/**`, `src/app/api/active-farm/**`; `src/lib/services/{multi-tenant-isolation.test,fake-prisma}.ts`        | One farm reading or writing another farm's records                               |
| **Financial calculations**    | `src/lib/finance-math.ts`, `src/lib/services/{reports,dashboard,expenses,egg-sales,bird-transactions}.ts`, `src/lib/validation/{expenses,egg-sales,bird-transactions}.ts`                                                                                             | Wrong totals, rounding drift, figures a farmer makes decisions on                |
| **Data model**                | `prisma/schema.prisma`, `prisma/migrations/**` (especially anything the release safety scan calls destructive)                                                                                                                                                        | Data loss that a deployment rollback cannot undo                                 |
| **Secrets and outbound I/O**  | `src/lib/push.ts`, `src/lib/push-utils.ts`, `src/lib/services/push-subscriptions.ts`, `src/lib/validation/push.ts`, `src/lib/email.ts`, `src/app/api/{cron,health,blob,notifications,push}/**`, `src/sentry.*.config.ts`, `src/instrumentation*.ts`, `next.config.ts` | Secret or PII leak (including into Sentry), SSRF, the app used as a spam relay   |
| **Build, CI and release**     | `.github/workflows/**`, `.github/scripts/check-npm-audit.mjs` (new exceptions), the `vercel-build` script in `package.json`                                                                                                                                           | A gate silently disabled, migrations run against the wrong database              |
| **Major dependency upgrades** | A major bump — or any `next-auth` beta bump — of `next`, `next-auth`, `prisma` / `@prisma/*`, `@neondatabase/serverless`, `bcryptjs`, `web-push`, `@sentry/nextjs`                                                                                                    | Behaviour changes in auth, queries or error reporting that the tests don't cover |

Most Dependabot minor/patch PRs, UI work, and new CRUD screens that follow the
existing service and route patterns are **not** high-risk.

---

## Requesting a co-review

1. Tick **High-risk change** in the PR template and add the
   `needs-human-review` label.
2. In the PR description, write two or three sentences for someone without the
   full context: _what could go wrong_, and _which file or function to look at
   first_. Point them at the matching section of [`REVIEW.md`](../REVIEW.md).
3. Request a review from the co-reviewer (they need to be a repository
   collaborator to be requested; the repo is public, so they can also comment
   without it) and send them the link.
4. Keep the ask small: one focused question, a diff that can be read in about
   30 minutes. Split the PR if it can't.

The co-reviewer is looking for the specific risk — a missing `farmId`, a
rounding error, a destructive migration — not style. CI and the maintainer's
own review cover the rest.

**Expected turnaround:** within 3 days. This is a favour, not an SLA.

**The reviewer never needs** Vercel, Neon, Sentry or Resend access, `.env`
files, or production data. Reviewing the code on GitHub is the whole job.

---

## When no reviewer is available

Never block a fix on a co-review. If nobody is available, or there's no answer
after 3 days:

1. Say so in the PR: `Co-review: not available — self-reviewed.`
2. Work through the self-review checklist below and tick it in the PR.
3. Merge, and leave the `needs-human-review` label on. A reviewer can still look
   at it after merge — a post-merge review that finds a bug is still worth it.

For an urgent production fix, merge first and ask for the review afterwards.

### Self-review checklist

- [ ] Re-read the full diff on GitHub after a break (next day, if it can wait)
- [ ] Worked through every section of [`REVIEW.md`](../REVIEW.md) against the diff
- [ ] **Tenant scoping:** every new query matches one of the two patterns in
      `REVIEW.md`; a new farm-owned model has cases in
      `src/lib/services/multi-tenant-isolation.test.ts`
- [ ] **Money:** a changed calculation has a test in
      `src/lib/finance-math.test.ts` (or next to the service) with a hand-checked
      expected value
- [ ] **Migrations:** ran a `PROD_deployment` **dry_run** and read which
      migrations it would apply; nothing destructive without the
      expand-then-contract split in [`RELEASE.md`](RELEASE.md)
- [ ] **Secrets / outbound:** no secret, token or personal data in logs,
      Sentry events, error responses or client bundles
- [ ] **Dependencies:** read the upstream changelog/migration guide for the
      major version, not just the green CI run
