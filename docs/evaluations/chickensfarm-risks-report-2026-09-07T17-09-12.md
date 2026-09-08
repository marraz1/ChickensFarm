# ChickensFarm — ATP Product Risk Report

**Overall: LOW risk** · low confidence · Last evaluated: 2026-09-07

Multi-tenant farm management web app for Lithuanian poultry farmers — egg tracking, bird inventory, financial ledger, push notifications.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Prisma · Neon PostgreSQL · NextAuth v5 · Vitest · GitHub Actions · Vercel

> Markdown duplicate of `chickensfarm-risks-report-2026-09-07T17-09-12.html`.

## How to read this report

- **Focus.** The badge on each risk — how much attention it needs right now. Computed as Risk score × (1 − QA maturity / 100), so strong QA practice reduces focus even when inherent risk is high. Red ≥ 15, Yellow 8–14, Green < 8. Focus on the highest values first.
- **Risk score.** Inherent risk = Impact × Likelihood, each on a 1–5 scale (max 25). Independent of QA practices — it's the "what could go wrong and how likely."
- **QA maturity.** 0–100% derived from the QA practices that address the risk. Higher maturity lowers the focus score.
- **Confidence.** How strong the evidence behind the assessment is: _high_ — strong direct evidence; _medium_ — partial or indirect evidence; _low_ — little or no direct evidence, treat as exploratory. The product-level confidence is aggregated conservatively — it takes the lowest confidence of the constituent risks.

## Risk profile

Rows show focus (attention needed), columns show inherent risk (impact × likelihood). Numbers are risk counts per bucket.

| Focus \ Risk | High | Medium | Low |
| ------------ | ---- | ------ | --- |
| **High**     | 1    | —      | —   |
| **Medium**   | 1    | 8      | —   |
| **Low**      | —    | 4      | 13  |

## Top risks by focus score

| Focus | Risk                                    | Category                  |
| ----- | --------------------------------------- | ------------------------- |
| 16.0  | No Dependency Vulnerability Scanning    | Security                  |
| 12.0  | GDPR Compliance Gap                     | Compliance and Regulatory |
| 12.0  | Solo Maintainer Knowledge Concentration | Maintainability           |
| 11.3  | Multi-Tenant Data Isolation Unverified  | Security                  |
| 9.0   | Undocumented Data Processor Agreements  | Compliance and Regulatory |

## Top recommendations

| Source risk                             | Recommendation                                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No Dependency Vulnerability Scanning    | Add `npm audit --audit-level=high` as a step in `ci.yml` — fails the build only on high/critical CVEs                                                                                 |
| No Dependency Vulnerability Scanning    | Enable GitHub Dependabot security alerts in the repository settings (free, automatic)                                                                                                 |
| No Dependency Vulnerability Scanning    | Consider Snyk for more comprehensive scanning with remediation suggestions                                                                                                            |
| GDPR Compliance Gap                     | Write a minimal privacy notice (can be a single page) accessible from the login/register screen                                                                                       |
| GDPR Compliance Gap                     | Review Resend, Neon, and Vercel DPA agreements — all three offer GDPR DPAs; sign and document them                                                                                    |
| GDPR Compliance Gap                     | If the app is used only by the builder for their own farm data (sole-trader personal use), GDPR may apply more lightly — but any third-party users trigger full obligations           |
| Solo Maintainer Knowledge Concentration | Write a brief architecture overview document covering: multi-tenant data model, auth flow, push notification design, and the financial calculation approach                           |
| Solo Maintainer Knowledge Concentration | Consider bringing in an occasional co-reviewer (friend, colleague) even for high-risk changes — one human reviewer who knows the domain is worth more than unlimited AI review        |
| Multi-Tenant Data Isolation Unverified  | Add a `multi-tenant-isolation.test.ts` integration test suite that seeds two farms, authenticates as Farm A, and asserts that all API routes return 403/404 for Farm B's resource IDs |
| Multi-Tenant Data Isolation Unverified  | This is the single highest-impact test to write for this codebase given the financial data involved                                                                                   |

## Compatibility

### Beta Dependency Breaking Changes — Focus 6.8

_high confidence · Focus 6.8 · Risk score 9 (Impact 3 × Likelihood 3) · QA maturity 25%_

NextAuth v5 (`^5.0.0-beta.31`) is a beta release with a history of API changes between pre-releases. React 19 and Tailwind v4 are newly stable but not yet battle-hardened. An upstream breaking change could break authentication or the UI without warning.

**Indicators**

- `next-auth: ^5.0.0-beta.31` — beta version with active API changes
- `react: 19.2.4`, `tailwindcss: ^4` — recently released major versions
- `AGENTS.md` explicitly warns "This version has breaking changes — APIs, conventions, and file structure may all differ from your training data"
- No Dependabot or Renovate configured (no `.github/dependabot.yml` found)

**Mitigation actions**

- Pin `next-auth` to an exact version (remove `^` semver range) until v5 stable release
- Add Dependabot (`dependabot.yml`) to automate dependency update PRs and run CI against them automatically

### No Cross-Browser Testing — Focus 4.0

_low confidence · Focus 4.0 · Risk score 4 (Impact 2 × Likelihood 2) · QA maturity 0%_

No browser support matrix is documented and no cross-browser CI tests exist. React 19 and Next.js 16 have good modern-browser coverage, but service worker registration (`/sw.js`) and Web Push API have varying support across browsers and mobile platforms.

**Indicators**

- No cross-browser test configuration in `stack.md` or CI workflows
- Web Push API and Service Worker (`/sw.js`) have limited support on iOS Safari
- No documented browser support matrix

**Mitigation actions**

- Document the supported browser/platform matrix explicitly — even a short `docs/browser-support.md`
- Test push notification behaviour on iOS Safari specifically (Web Push on iOS has restrictions)

## Competitive Positioning

### No Competitive Landscape Assessment — Focus 4.0

_low confidence · Focus 4.0 · Risk score 4 (Impact 2 × Likelihood 2) · QA maturity 0%_

No documented assessment of alternative farm management tools (commercial apps, spreadsheet templates) exists. For a solo niche project this is low priority, but understanding why users might prefer alternatives helps focus development on genuine differentiators.

**Indicators**

- No competitive analysis or alternative assessment in the repo
- Farm management is an established market with existing commercial apps (FarmLogs, AgriWebb, etc.)
- Lithuanian-language niche may be a genuine differentiator with few direct competitors

**Mitigation actions**

- Write a one-page competitor overview: "Why not use [App X] instead?" — even if the answer is "Lithuanian language + free + simpler", document it
- This doubles as onboarding material for new users evaluating the app

## Compliance and Regulatory

### GDPR Compliance Gap — Focus 12.0

_medium confidence · Focus 12.0 · Risk score 12 (Impact 4 × Likelihood 3) · QA maturity 0%_

The app processes personal data of EU/EEA users (Lithuanian farmers) — email addresses, farm financial records, bird inventory linked to identifiable farm owners. GDPR applies. No privacy policy, DPIA, or documented lawful basis for processing is visible in the repo. For a small sole-trader deployment this risk may be low in practice, but it is legally non-zero.

**Indicators**

- Lithuanian users are EU data subjects — GDPR applies
- Personal data processed: user email, name (optional), farm financial records, push subscription data
- No `privacy-policy.md`, no DPIA documentation in repo
- Resend (email delivery), Neon (database), Vercel (hosting) are US-based data processors — DPA needed
- `prisma/schema.prisma` stores `email`, `passwordHash`, `PushSubscription` data

**Mitigation actions**

- Write a minimal privacy notice (can be a single page) accessible from the login/register screen
- Review Resend, Neon, and Vercel DPA agreements — all three offer GDPR DPAs; sign and document them
- If the app is used only by the builder for their own farm data (sole-trader personal use), GDPR may apply more lightly — but any third-party users trigger full obligations

### Undocumented Data Processor Agreements — Focus 9.0

_medium confidence · Focus 9.0 · Risk score 9 (Impact 3 × Likelihood 3) · QA maturity 0%_

Three US-based services process personal data on behalf of the app: Resend (email delivery), Neon (database hosting), and Vercel (serverless hosting). Under GDPR, Data Processing Agreements (DPAs) are required with each. All three provide DPAs, but no documentation confirms they have been signed or reviewed.

**Indicators**

- `resend: ^6.16.0` — processes user email addresses for notification delivery
- `@neondatabase/serverless` — stores all personal and financial data in US-hosted infrastructure
- Vercel hosting — processes requests containing session tokens and personal data
- No DPA documentation in the repo

**Mitigation actions**

- Sign the Resend DPA (available in account settings), Neon DPA, and Vercel DPA
- Add a `docs/compliance.md` with a table: processor → service used → DPA signed date

## Context Coverage

### Mobile and Field Use Untested — Focus 9.0

_low confidence · Focus 9.0 · Risk score 9 (Impact 3 × Likelihood 3) · QA maturity 0%_

Farmers are likely to use this app on mobile devices in the field (recording egg collections at the coop, tracking birds while outdoors). No mobile-specific testing has been conducted. The Web Push notification feature is especially sensitive to mobile browser compatibility (iOS Safari restrictions).

**Indicators**

- No mobile testing or responsive design verification in CI
- `web-push` library and `/sw.js` service worker have known iOS Safari limitations
- No documented browser/device support matrix
- Push notification reminder workflow assumes consistent mobile browser behaviour

**Mitigation actions**

- Test the full workflow (login, data entry, push notification opt-in) on iOS Safari and Android Chrome
- Document iOS Web Push requirements in the app's onboarding flow — users must install as PWA on iOS for notifications to work

## Effectiveness

### No User Effectiveness Measurement — Focus 6.0

_low confidence · Focus 6.0 · Risk score 6 (Impact 2 × Likelihood 3) · QA maturity 0%_

Task completion rates for primary user workflows (recording egg collections, tracking finances, managing bird inventory) have never been measured. The product may be functionally complete but still fail users at key interaction points without the team knowing.

**Indicators**

- No analytics library in `package.json`
- No usability test results documented
- No funnel or task completion tracking

**Mitigation actions**

- Add Vercel Analytics (one-line addition to `layout.tsx`) to establish a baseline of page visits and session patterns
- Observe 1–2 actual farmers completing the primary workflows to identify friction points before they scale

## Efficiency

### Daily Workflow Efficiency Unmeasured — Focus 6.0

_low confidence · Focus 6.0 · Risk score 6 (Impact 2 × Likelihood 3) · QA maturity 0%_

Farmers use this app for daily data entry (egg records, expenses, bird updates). If core workflows require more steps than the equivalent manual process, the app creates friction instead of reducing it — but time-on-task has never been measured.

**Indicators**

- No time-on-task benchmarking or workflow mapping documented
- No keyboard shortcuts or batch entry features evidenced in the stack
- Push notifications for reminders (positive — reduces friction for recall)
- No analytics to identify where users spend disproportionate time

**Mitigation actions**

- Conduct a timed walkthrough of the 3 most frequent daily tasks and compare to the manual alternative
- Add Vercel Analytics to see which pages have high time-on-page (possible friction indicator)

## Flexibility

### Vercel and Neon Vendor Lock-In — Focus 6.0

_medium confidence · Focus 6.0 · Risk score 6 (Impact 3 × Likelihood 2) · QA maturity 0%_

The product is deeply coupled to Vercel (hosting, deployment pipeline, Vercel Blob storage) and Neon (serverless PostgreSQL via adapter). Migrating away from either would require architectural changes. For a solo project with a stable business model, this is an accepted trade-off — but it should be a conscious one.

**Indicators**

- `@vercel/blob` used for file storage (Vercel-specific API)
- `@neondatabase/serverless` + `@prisma/adapter-neon` create Neon-specific database coupling
- Deployment pipeline tightly integrated with Vercel GitHub integration and Vercel deployment API
- No IaC (Terraform/Bicep) to enable reproducible deployment to another provider

**Mitigation actions**

- Document the lock-in decision explicitly in `docs/decisions.md`: "We use Vercel+Neon by design for their DX and free tier; migration cost is estimated at X days if needed"
- Prisma's adapter pattern already isolates the database from business logic — if Neon ever discontinues, swapping the adapter is feasible

## Freedom from Risk

### Multi-Tenant Data Leakage Economic Harm — Focus 9.0

_medium confidence · Focus 9.0 · Risk score 12 (Impact 4 × Likelihood 3) · QA maturity 25%_

A farmId scoping bug that exposes one farm's financial records, egg data, or bird inventory to another farm's user would constitute both a data breach and an economic harm — the exposed data is the business records of a farming operation. Users act on financial summaries without secondary verification (the app IS the record).

**Indicators**

- Financial data (income, expenses, transactions) stored per farm — exposure has direct economic consequence
- No integration test verifies cross-farm data isolation at runtime
- No error monitoring to detect if a scoping bug causes unexpected data returns
- `database-migration-safety` prevents corruption but not query-level scoping bugs

**Mitigation actions**

- Write a `multi-tenant-isolation.test.ts` — seeds two farms, authenticates each, verifies all resource endpoints return 403/404 for cross-farm IDs
- Add Sentry to catch unexpected server errors that may indicate a scoping failure reaching the error handler

## Functional Suitability

### Unverified Service Layer Correctness — Focus 9.0

_medium confidence · Focus 9.0 · Risk score 12 (Impact 4 × Likelihood 3) · QA maturity 25%_

The `src/lib/services/` layer implements all data access including multi-tenant `farmId` scoping, yet has zero automated tests. A logic error in how farm-owned rows are queried could silently serve incorrect or another farm's data — with financial consequences for the user.

**Indicators**

- No test files exist for any file under `src/lib/services/` (all 4 unit test files cover isolated utilities only)
- CodeRabbit path instruction enforces `farmId` scoping pattern in review, but this is post-hoc, not preventive
- `vitest run --passWithNoTests` means the test gate passes even if someone deletes all tests

**Mitigation actions**

- Write integration tests for `src/lib/services/` focusing on multi-tenant scoping: one test per service that verifies a user from Farm A cannot read Farm B's data
- Remove `--passWithNoTests` to ensure a future delete of test files doesn't silently green CI

### No End-to-End Journey Coverage — Focus 6.8

_medium confidence · Focus 6.8 · Risk score 9 (Impact 3 × Likelihood 3) · QA maturity 25%_

Core user journeys — recording an egg collection, logging a bird transaction, viewing financial summaries — have never been tested end-to-end in a realistic browser context. Regressions in these flows can reach production undetected.

**Indicators**

- No Playwright, Cypress, or equivalent E2E test framework in `package.json`
- Post-deploy smoke tests are HTTP probes (`/login`, `/`, `/sw.js`) — not user-flow assertions
- No `stack.md` E2E testing entry

**Mitigation actions**

- Add Playwright (already in the CI job chain — the `preview` job waits for the Vercel build) and write 2–3 smoke-level E2E tests covering: login, create an egg collection record, view the financial dashboard

## Interaction Capability

### No Accessibility Assessment — Focus 6.0

_medium confidence · Focus 6.0 · Risk score 6 (Impact 2 × Likelihood 3) · QA maturity 0%_

No WCAG audit, `eslint-plugin-jsx-a11y`, or axe-core scan has been run. While the target audience (Lithuanian farmers) may not have high a11y requirements, unaddressed accessibility issues could exclude users with visual impairments and create barriers for mobile-first use in field conditions.

**Indicators**

- No `eslint-plugin-jsx-a11y` in `package.json`
- No Playwright axe-core integration in stack
- No WCAG compliance documentation
- CodeRabbit path instruction for TSX does not include accessibility checks

**Mitigation actions**

- Add `eslint-plugin-jsx-a11y` to `eslint.config.mjs` — one-package addition to the existing ESLint config
- Run a one-time axe-core scan against the deployed app to find any critical violations before they accumulate

### No Usability Validation with Real Users — Focus 6.0

_low confidence · Focus 6.0 · Risk score 6 (Impact 2 × Likelihood 3) · QA maturity 0%_

No usability testing with real Lithuanian farmers has been documented. The builder may be the primary user, which reduces this risk somewhat — but if the product serves additional users, design decisions based solely on builder intuition may not generalise.

**Indicators**

- No usability test results, user interviews, or session recordings referenced in the repo
- No analytics to identify where users drop off
- Target user (non-technical Lithuanian farmer) may have different mental models than the builder

**Mitigation actions**

- Recruit 2–3 actual farmers for a 30-minute walkthrough session — five participants reveal ~80% of usability issues
- Add a simple feedback link (mailto or form) in the app footer to passively collect pain points

## Maintainability

### Solo Maintainer Knowledge Concentration — Focus 12.0

_high confidence · Focus 12.0 · Risk score 12 (Impact 4 × Likelihood 3) · QA maturity 0%_

All knowledge of the codebase is concentrated in a single person. Extended unavailability of the maintainer would halt all development and make even urgent bug fixes risky for anyone brought in to help.

**Indicators**

- `.coderabbit.yaml` explicitly states "This is a small solo-maintained project"
- No team members listed in any CLAUDE.md or documentation
- No pair programming, code review from a human peer, or documented onboarding materials

**Mitigation actions**

- Write a brief architecture overview document covering: multi-tenant data model, auth flow, push notification design, and the financial calculation approach
- Consider bringing in an occasional co-reviewer (friend, colleague) even for high-risk changes — one human reviewer who knows the domain is worth more than unlimited AI review

### Beta Dependency Upgrade Debt — Focus 6.8

_medium confidence · Focus 6.8 · Risk score 9 (Impact 3 × Likelihood 3) · QA maturity 25%_

NextAuth v5 beta is a pre-stable library undergoing active API changes. When v5 stable releases, migrating from beta to stable may require code changes across auth-related files. Deferring this migration accumulates upgrade debt and keeps the app on an unsupported pre-release.

**Indicators**

- `next-auth: ^5.0.0-beta.31` — pre-stable dependency with known API changes between beta releases
- No Dependabot or Renovate configured to proactively surface dependency updates
- `AGENTS.md` warns about breaking changes in Next.js 16 — indicates awareness of upgrade risk

**Mitigation actions**

- Add `.github/dependabot.yml` with `ecosystem: npm` and `schedule: weekly` — automates upgrade PR creation
- Follow NextAuth v5 release notes and plan migration to stable as soon as it ships

## Market Fit and Value

### Unvalidated User Adoption Beyond Builder — Focus 6.0

_low confidence · Focus 6.0 · Risk score 6 (Impact 2 × Likelihood 3) · QA maturity 0%_

No analytics or user research confirms whether the product has adopted users beyond the builder. The builder-as-primary-user model reduces fit risk significantly, but without measurement there is no signal if the product stops delivering value as the user base grows.

**Indicators**

- No analytics (page views, active users, retention) in `package.json`
- No user research or interviews documented
- No documented user count or adoption metrics

**Mitigation actions**

- Add Vercel Analytics to establish baseline active users and return visit rate
- Set a simple North Star metric: "weekly active farms recording data" — track it over 3 months

## Performance Efficiency

### No Performance Baseline or Monitoring — Focus 6.0

_medium confidence · Focus 6.0 · Risk score 6 (Impact 2 × Likelihood 3) · QA maturity 0%_

No response time benchmarks, performance SLAs, or production performance monitoring exist. A regression that doubles API latency would go undetected until users complain.

**Indicators**

- No APM or performance monitoring in `stack.md`
- No performance tests in the CI pipeline
- No response time SLAs documented anywhere in the repo

**Mitigation actions**

- Add Lighthouse CI or a simple curl-based response time check to the CI pipeline for key pages
- Consider Vercel's built-in Web Analytics for Core Web Vitals tracking (free tier available)

### Serverless Cold Start Latency — Focus 6.0

_medium confidence · Focus 6.0 · Risk score 6 (Impact 2 × Likelihood 3) · QA maturity 0%_

Both Vercel (serverless functions) and Neon (serverless PostgreSQL) have cold start latency. Infrequent users — typical for a niche farm management app — are more likely to encounter cold instances, resulting in sluggish first-request response times that could undermine user trust.

**Indicators**

- Hosting on Vercel serverless + Neon serverless — both have documented cold-start characteristics
- No performance benchmarks or SLAs defined
- `stack.md` notes no APM or performance monitoring

**Mitigation actions**

- Enable Vercel function warming or use Vercel's Edge Runtime for latency-sensitive routes
- Add Neon connection pooling configuration if not already enabled
- Monitor cold-start frequency via `/api/health` response times (already instrumented in deployment pipeline)

## Reliability

### No Production Error Monitoring — Focus 9.0

_high confidence · Focus 9.0 · Risk score 12 (Impact 3 × Likelihood 4) · QA maturity 25%_

No error tracking tool (Sentry, Bugsnag, etc.) is configured. Production errors are discovered only when users report them or when the deployment pipeline's post-deploy smoke tests catch them — which only run at release time, not continuously.

**Indicators**

- No error monitoring library in `package.json`
- `stack.md` explicitly notes: "Error tracking: Not detected"
- Monitoring & Observability signal scored −20 (medium confidence)
- Smoke tests run only during production releases, not continuously

**Mitigation actions**

- Add Sentry (`@sentry/nextjs`) — free tier covers small projects; provides error grouping, stack traces, and email alerts
- Wire `/api/health` to an uptime monitor (UptimeRobot free tier, or Vercel's built-in health checks) for continuous availability monitoring

### Undetected Service Layer Failures — Focus 6.8

_medium confidence · Focus 6.8 · Risk score 9 (Impact 3 × Likelihood 3) · QA maturity 25%_

The `src/lib/services/` data access layer has no automated tests. Errors in Prisma queries, connection handling, or multi-tenant scoping can fail silently or produce incorrect data without triggering any alert.

**Indicators**

- Zero test coverage of `src/lib/services/` (confirmed from test file inventory)
- No error monitoring to surface runtime service failures in production
- `src/lib/errors.ts` exists (error handling utilities) but its coverage in service error paths is untested

**Mitigation actions**

- Use Neon's database branching feature to create isolated test databases for service integration tests
- Add at least one integration test per service module verifying the happy path and the `farmId` scoping boundary

## Safety

### Financial Calculation Errors — Focus 3.0

_high confidence · Focus 3.0 · Risk score 6 (Impact 3 × Likelihood 2) · QA maturity 50%_

Incorrect financial totals (income, expenses, profit) could mislead farming business decisions. This risk is meaningfully controlled: `finance-math.test.ts` specifically tests `toCents` and `buildMonthlyTotals` with edge cases including floating-point precision, null inputs, and year-boundary ordering.

**Indicators**

- The app tracks income and expenses for a farming business — financial accuracy has real economic consequence
- Floating-point arithmetic in financial calculations is a known risk (the test suite explicitly tests for this)
- No integration test verifies that financial data flows correctly from database through service to UI

**Mitigation actions**

- Add a property-based test or fuzz test for financial calculation functions (fast-check or similar)
- Add an integration test that seeds known financial records and asserts the API returns the correct aggregated totals

## Satisfaction

### No User Satisfaction Tracking — Focus 6.0

_low confidence · Focus 6.0 · Risk score 6 (Impact 2 × Likelihood 3) · QA maturity 0%_

No satisfaction measurement (NPS, CSAT, in-app feedback) exists. If users find the app frustrating or abandon it after initial use, there is no signal to prompt improvement. For a solo project the builder may use personally, this risk is lower — but any additional users are invisible.

**Indicators**

- No analytics or feedback collection in `package.json`
- No in-app feedback mechanism evidenced in the codebase
- No user communication channel referenced in the repo

**Mitigation actions**

- Add a "Send feedback" mailto link in the app footer — zero infrastructure cost, gives users a direct channel
- Add Vercel Analytics to track whether users return after their first session

## Security

### No Dependency Vulnerability Scanning — Focus 16.0

_high confidence · Focus 16.0 · Risk score 16 (Impact 4 × Likelihood 4) · QA maturity 0%_

`npm audit` is not in the CI pipeline and no dependency scanner (Snyk, Dependabot security alerts) is configured. Known CVEs in the 531-package dependency tree could go unnoticed for months on a multi-tenant app handling user credentials and financial data.

**Indicators**

- `stack.md` explicitly notes: "No security scanning (Trivy/Snyk/npm audit) detected in CI"
- CI workflow `ci.yml` has no security scanning step
- `prod-deployment.yml` has no vulnerability gate
- 531 packages installed (`npm install` output)
- beta dependencies (NextAuth v5 beta) have higher CVE surface area during pre-release

**Mitigation actions**

- Add `npm audit --audit-level=high` as a step in `ci.yml` — fails the build only on high/critical CVEs
- Enable GitHub Dependabot security alerts in the repository settings (free, automatic)
- Consider Snyk for more comprehensive scanning with remediation suggestions

### Multi-Tenant Data Isolation Unverified — Focus 11.3

_medium confidence · Focus 11.3 · Risk score 15 (Impact 5 × Likelihood 3) · QA maturity 25%_

The app is multi-tenant — all farm data must be isolated by `farmId`. While CodeRabbit actively enforces `farmId` scoping in code review, there are no automated integration tests that verify a user from Farm A cannot access Farm B's data at runtime. A single missed scope in a query would constitute a data breach.

**Indicators**

- CodeRabbit path instruction explicitly enforces `farmId` scoping pattern (`src/lib/services/**/*.ts`)
- No integration test verifies tenant isolation end-to-end
- Two valid scoping patterns documented (direct `where.farmId` or `findFirst` guard) — code review catches deviations, but runtime verification is absent
- Financial data (expenses, income, bird transactions) and personal records in scope

**Mitigation actions**

- Add a `multi-tenant-isolation.test.ts` integration test suite that seeds two farms, authenticates as Farm A, and asserts that all API routes return 403/404 for Farm B's resource IDs
- This is the single highest-impact test to write for this codebase given the financial data involved

### No SAST or Security Review — Focus 9.0

_medium confidence · Focus 9.0 · Risk score 12 (Impact 4 × Likelihood 3) · QA maturity 25%_

No static application security testing (SAST), dynamic testing (DAST), or penetration test has been conducted. Authentication is handled by NextAuth v5 beta — a non-stable library. For a publicly accessible multi-tenant app processing user credentials and financial data, this leaves the attack surface uncharacterised.

**Indicators**

- No SAST tooling (CodeQL, Semgrep, SonarQube) in CI or repo
- `next-auth: ^5.0.0-beta.31` — pre-stable auth library
- No threat model documentation in repo
- Password hashing via `bcryptjs` (correct choice) but full auth implementation not independently reviewed

**Mitigation actions**

- Enable GitHub CodeQL in the repository (one YAML file addition to `.github/workflows/`) — free SAST covering common vulnerability patterns
- Conduct a one-time self-review of all API route handlers against OWASP API Top 10 before the user base grows

## Stakeholder Alignment

### No User Feedback Channel — Focus 4.0

_low confidence · Focus 4.0 · Risk score 4 (Impact 2 × Likelihood 2) · QA maturity 0%_

For a solo project the builder is the primary stakeholder, which keeps this risk low. However, as the user base grows beyond the builder, there is no structured channel for users to communicate needs or report issues — silent dissatisfaction could build without visibility.

**Indicators**

- No in-app feedback mechanism evidenced
- No issue tracker linked from within the app
- Solo project structure means no formal stakeholder process needed currently

**Mitigation actions**

- Add a "Report an issue" or "Send feedback" link in the app accessible to all users — even a mailto link is better than nothing

---

Generated by ATP portal on 2026-09-07 14:09:12 UTC. Data source: ATP evaluation files under `_data/`.
