# Testing approach

A one-page account of what this repo tests, what it does not, and why. It
describes the state of `main` as of writing; check `git ls-files '*.test.ts'`
and `.github/workflows/ci.yml` if it looks stale.

## Principle

The suite is small and risk-driven. Test what would hurt a farm if it broke
silently, and what can be tested fast with no external services. Everything
else is covered by review ([REVIEW.md](../REVIEW.md),
[review-process.md](review-process.md)) and by the type checker and linter.

## What runs today

Tooling: [Vitest](../vitest.config.mts) (`npm test`, node environment, `@`
alias only). No coverage tool and no coverage threshold are configured.
`npm test` runs `vitest run` without `--passWithNoTests`, so the Test gate
fails (exit code 1) if no test files are found. Deleting the suites does not
leave CI green.

CI ([ci.yml](../.github/workflows/ci.yml)) runs on PRs and pushes to `develop`,
`main` and `release`, as separate parallel jobs: Prettier on changed files and
ESLint (`Lint`), `npm run typecheck`, `npm test` (`Test`), `npm audit` for
high/critical CVEs, and a Vercel preview build on PRs. `prod-deployment.yml`
also runs lint, typecheck and tests before promotion.

## What is tested, and why

| Area             | Files                                                                                     | Why                                                                                                                                                                                                                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tenant isolation | `src/lib/services/multi-tenant-isolation.test.ts`                                         | The highest-risk defect: a dropped `farmId` in a `where` exposes one farm's data to another, and neither TypeScript nor ESLint catches it. Runs the real service functions for breeds, bird groups/transactions/consumptions, egg collections/sales/consumptions, expenses, losses, mother hens and incubation cycles, plus the farm-membership guard. |
| Money and dates  | `finance-math.test.ts`, `notification-schedule.test.ts`                                   | Pure functions with hand-checkable answers; wrong numbers are quiet failures.                                                                                                                                                                                                                                                                          |
| Service logic    | `services/bird-consumptions.test.ts`, `flock-reductions.test.ts`, `notifications.test.ts` | Business rules with stateful edge cases (e.g. flock counts).                                                                                                                                                                                                                                                                                           |
| Validation       | `validation/{bird-consumptions,notifications,push}.test.ts`                               | zod schemas are the input boundary of every API route.                                                                                                                                                                                                                                                                                                 |
| Infrastructure   | `api-utils`, `errors`, `rate-limit`, `push-utils`, `middleware` tests                     | Shared error mapping, throttling, push payloads and the auth middleware.                                                                                                                                                                                                                                                                               |
| Routes           | `api/health/route.test.ts`, `api/notifications/test/route.test.ts`                        | Only two route handlers have direct tests.                                                                                                                                                                                                                                                                                                             |

## How it runs without a database

CI has no reachable database (`DATABASE_URL` in `ci.yml` is a placeholder so
`prisma generate` succeeds). Service tests therefore run against
`src/lib/services/fake-prisma.ts`, an in-memory fake that stores rows and
evaluates real `where` clauses, so removing a `farmId` guard still turns the
suite red. The trade-off: the fake covers only the Prisma features it
implements, so it cannot prove real SQL, constraint, transaction or migration
behaviour.

## What is not tested, and why

- **No end-to-end or browser tests.** Playwright E2E is tracked in #95 and is
  in progress; it is not part of the repo or CI yet, so treat every UI flow as
  manually verified.
- **No component or UI tests.** There are no React Testing Library or jsdom
  tests for `src/components/**` or pages. The UI is mostly thin forms over the
  API; the effort went to the data layer first.
- **Most API routes have no direct test.** The route contract (guard, zod
  parse, service call, `handleApiError`) is enforced by review, not tests.
  Services and validation underneath are the tested surface.
- **No real-database tests.** Prisma migrations, the schema and real queries
  are only exercised on the Vercel preview/production build; there is no
  Postgres service in CI.
- **Services without dedicated tests**, beyond isolation checks: `dashboard`,
  `reports`, `reminders`, `push-subscriptions`, `farms`, `auth`, `data-presence`.
- **Not covered at all:** the PWA/service worker, push delivery, cron
  endpoints end-to-end, Sentry wiring, accessibility, performance and load.
- **No coverage measurement**, so gaps above come from reading the tree, not
  from a report.

## Rules for new work

1. New or changed query in `src/lib/services/**`: add a case to the isolation
   suite.
2. Changed money or date calculation: a test with a hand-checked expected value.
3. New zod schema: a validation test for accepted and rejected input.
4. Fix a bug: add a failing test first where the code is testable.
5. Keep tests DB-free and fast; use the fake Prisma client, not a live database.

## Likely next steps

Playwright smoke tests for login and the main record flows (#95); route-level
tests for the guard/400/error contract; a coverage report to make the gaps
above measurable.
