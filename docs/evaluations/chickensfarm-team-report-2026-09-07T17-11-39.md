# ChickensFarm — ATP Team Report

**Overall score: 9** · low confidence · Last evaluated: 2026-09-07

ChickensFarm is a solo-maintained Lithuanian farm management app. Its strongest dimension is Code & System: the CI/CD pipeline is exceptionally mature (+75), code quality tooling is solid (+42), and responsible testing is neutral (+5) with high-quality but narrow unit tests. Monitoring is a meaningful gap (−20). Product and culture criteria are largely inapplicable or unassessable without sprint/backlog data — the team-based criteria (teamwork, psychological safety, trust) score neutral by structural inapplicability for a solo project.

> Markdown duplicate of `chickensfarm-team-report-2026-09-07T17-11-39.html`.

## How to read this report

- **Score.** An AI judgment on a −100 to +100 scale, weighing the significance of the signals — not a count. A single critical negative signal can outweigh many minor positives. Green > 33 (on track), Yellow −33 to 33 (needs attention), Red < −33 (critical gaps). Focus on the lowest scores first.
- **Confidence.** How strong the evidence behind the score is: _high_ — strong direct evidence; _medium_ — partial or indirect evidence; _low_ — little or no direct evidence, treat as exploratory. Pillar and overall confidence are aggregated conservatively — they take the lowest confidence of the constituent criteria.

## Pillar scores

| Pillar        | Score | Confidence |
| ------------- | ----- | ---------- |
| Product       | −3    | low        |
| Code & System | 26    | medium     |
| Teamwork      | −1    | low        |
| Culture       | 11    | low        |

## Top recommendations

| Source criterion                   | Recommendation                                                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monitoring & Observability         | Add Sentry (free tier covers small projects) to capture unhandled errors and performance data — the Next.js integration is a one-package install                                    |
| Monitoring & Observability         | The `/api/health` endpoint already exists — wire it to a simple uptime monitor (e.g. Vercel's health check, UptimeRobot) to get alerted before users notice downtime                |
| Monitoring & Observability         | Add structured error logging at the API layer using `src/lib/errors.ts` to ensure errors surface consistently in Vercel logs                                                        |
| Collaboration & Feedback Loops     | Consider bringing in a trusted reviewer (friend, colleague) for occasional design or code reviews — even monthly async feedback can surface blind spots a solo developer misses     |
| Collaboration & Feedback Loops     | Add a simple feedback mechanism in the app (e.g. a feedback link or in-app form) to create a loop with actual users                                                                 |
| Experimentation & Rapid Validation | For a small user base, even a manual "show this to 2–3 users and observe" step before building full polish adds validation cheaply                                                  |
| Experimentation & Rapid Validation | Consider simple feature flags (env var or database boolean) for higher-risk changes that could be toggled per-user                                                                  |
| Insight-Driven Decisions           | Add lightweight analytics (e.g. Vercel Analytics, PostHog free tier) to establish a baseline of how users interact with the app                                                     |
| Insight-Driven Decisions           | When adding features, document the hypothesis and expected outcome — even one sentence in the PR description creates a feedback loop                                                |
| Outcomes over Output               | Define 1–2 measurable outcomes for the next quarter (e.g. "reduce time to record a daily egg collection to under 30 seconds") to create a feedback loop between building and impact |

## Product — score −3 (low confidence)

### Experimentation & Rapid Validation — −5

_low confidence · 0 positive · 3 negative · 3 in-person checks · 2 actions_

No feature flag, A/B testing, or incremental rollout infrastructure is present in the codebase. The production pipeline deploys fully to all users at once. For a solo-maintained niche app, informal validation (direct use by the builder or small user base) may substitute for formal experimentation, but there is no structural support for testing ideas cheaply before full commitment.

**Negative signals**

- No feature flag library or homegrown flag mechanism in the dependency list
- Production deployment promotes to `release` branch in one step — no staged rollout
- No evidence of experiment tickets or hypothesis documentation from available repo data

**In-person checks**

- Are new features validated with real users before full rollout, even informally?
- Has any planned feature been dropped or simplified after initial testing?
- Is the user base large enough to make formal A/B testing meaningful?

**Suggested actions**

- For a small user base, even a manual "show this to 2–3 users and observe" step before building full polish adds validation cheaply
- Consider simple feature flags (env var or database boolean) for higher-risk changes that could be toggled per-user

### Insight-Driven Decisions — −5

_low confidence · 0 positive · 3 negative · 3 in-person checks · 2 actions_

No analytics, usage tracking, or user research tooling is present in `package.json` (no PostHog, Mixpanel, Google Analytics, or equivalent). Without production usage data feeding decisions, the risk is that prioritisation is driven by builder intuition rather than observed user behaviour. Confidence is low — this is a solo project and some decisions may be made informally without tooling.

**Negative signals**

- No analytics or product metrics library in the dependency list
- No feature flag tooling to enable staged rollouts or A/B tests
- No evidence of hypothesis-driven work items from available repo data

**In-person checks**

- How are new features or changes prioritised — user feedback, usage data, or personal judgment?
- Are there any analytics (even basic page view tracking) in production?
- Has any feature been removed or deprioritised based on observed usage?

**Suggested actions**

- Add lightweight analytics (e.g. Vercel Analytics, PostHog free tier) to establish a baseline of how users interact with the app
- When adding features, document the hypothesis and expected outcome — even one sentence in the PR description creates a feedback loop

### Product Strategy & Focus — 0

_low confidence · 0 positive · 0 negative · 3 in-person checks · 2 actions_

ChickensFarm is a farm management web app (egg collections, bird tracking, finances, push notifications) targeting Lithuanian-speaking users. The product domain is clear from the source code, but no strategy documents, sprint goals, OKRs, or backlog items are available in the local repo — the score reflects absence of evidence, not confirmed absence of strategy.

**In-person checks**

- Is there a product roadmap, strategy doc, or OKRs document (even informal) the team works from?
- Do sprint goals describe outcomes ("reduce manual record-keeping time") or features ("build egg collection form")?
- How is the backlog prioritised — by stakeholder request, effort, or value?

**Suggested actions**

- Add a brief `docs/strategy.md` or link a shared doc from the README — even a one-pager clarifying who the product is for, what problem it solves, and what the next 3 months are building toward
- Frame sprint goals as outcomes rather than feature lists to create a shared "why" across the team

## Code & System — score 26 (medium confidence)

### CI/CD & Deployment Pipeline — 75

_high confidence · 7 positive · 3 negative · 2 in-person checks · 2 actions_

ChickensFarm has an exceptionally mature CI/CD setup for its size. `ci.yml` runs lint, typecheck, test, and Vercel preview build as parallel gates on every PR and push. `prod-deployment.yml` is a 5-stage sequential release pipeline (preflight → gates → release → deploy → verify) that versions the app, checks for schema drift, scans for destructive migrations, waits for Vercel to complete the build, confirms the new version is being served via `/api/health`, and runs smoke tests — all with a dry-run mode. The pipeline comments explain design decisions in detail.

**Positive signals**

- `ci.yml`: parallel lint, typecheck, test, and Vercel preview jobs with `cancel-in-progress: true` — fast, isolated feedback
- CI must pass on `main` before production release is allowed (preflight enforces this)
- Branch promotion chain: feature → develop → main → release — structured, intentional flow
- `prod-deployment.yml` checks for schema drift (`prisma migrate diff`) and scans pending migrations for destructive statements before tagging
- Post-deploy health verification: confirms the exact version and commit hash being served before marking the release complete
- Smoke tests run after deploy checking `/login`, `/`, `/manifest.webmanifest`, and `/sw.js` with content-type assertions
- Dry-run mode lets operators prove a release would succeed without actually shipping it

**Negative signals**

- No DORA metrics dashboard or tracking visible
- No explicit rollback procedure documented (Vercel supports instant rollback but it is not codified)
- No feature flags — all releases are all-or-nothing for all users

**In-person checks**

- Is the rollback process documented and has it been practised? Vercel supports it but it should be a known procedure.
- Are DORA metrics (deployment frequency, lead time, MTTR, change failure rate) tracked anywhere?

**Suggested actions**

- Add a brief rollback runbook (even 5 steps in `docs/runbook.md`) so the procedure is clear under pressure
- Consider tracking deployment frequency — the pipeline already tags every release, making this easy to measure from git tag history

### Code Quality & Technical Debt — 42

_medium confidence · 5 positive · 2 negative · 2 in-person checks · 2 actions_

The codebase shows clear quality hygiene: TypeScript enforced by CI typecheck, ESLint and Prettier as CI gates, CodeRabbit auto-reviewing PRs with detailed path-specific instructions (API guards, multi-tenant scoping, client component hygiene). Source structure is well-organised with `src/lib/services/` for data access, `src/lib/` for utilities, and `src/app/` for routes. Code comments explain non-obvious decisions (web-push external package, cache headers, CI design). No architecture decision records or explicit debt backlog are visible.

**Positive signals**

- TypeScript throughout with `npm run typecheck` as a mandatory CI gate
- ESLint + Prettier enforced on every PR and push — no style drift
- CodeRabbit configured with security-focused path instructions: API auth guards, multi-tenant `farmId` scoping, client component hygiene — reviews are substantive, not cosmetic
- Clear module boundaries: `src/lib/services/` for all data access, `src/lib/` for pure utilities, `src/app/` for Next.js routes — new developers can navigate without a guide
- Code comments explain WHY (not just WHAT): CI job split rationale, cache-control reasoning, `web-push` external package justification

**Negative signals**

- No Architecture Decision Records (ADRs) or equivalent design documentation visible
- No explicit tech debt backlog (no ADO/Jira data to assess whether debt is being tracked)

**In-person checks**

- Are there known debt items being tracked anywhere (even a `TODO.md` or tagged issues)?
- Are dependencies kept up to date? (Several cutting-edge dependencies like React 19 and NextAuth v5 beta carry upgrade risk)

**Suggested actions**

- Add ADRs for significant decisions already made (multi-tenant approach, Neon/Prisma choice, NextAuth v5 beta) — even brief records prevent re-litigating the same decisions
- Consider adding `npm audit --audit-level=high` to the CI pipeline to surface dependency vulnerabilities before they reach production

### Monitoring & Observability — −20

_medium confidence · 2 positive · 5 negative · 2 in-person checks · 3 actions_

ChickensFarm has a well-designed `/api/health` endpoint used by the deployment pipeline to confirm the live version, commit hash, migration state, and overall status. Beyond this, no observability tooling is present: no error tracking (no Sentry or similar), no APM, no structured logging library, and no alerting. The health endpoint tells the pipeline whether a deployment succeeded — it does not tell the team when something breaks in production.

**Positive signals**

- `/api/health` endpoint reports version, commit hash, applied/failed migrations, and overall status — used to verify deployments and could support uptime monitoring
- Deployment pipeline performs post-deploy health checks and smoke tests on key URLs

**Negative signals**

- No error monitoring library (no Sentry, Bugsnag, or equivalent) in `package.json`
- No APM or performance monitoring tooling visible
- No structured logging library — runtime errors produce unstructured Node.js output only
- No alerting setup visible (no PagerDuty, Vercel alerting config, or equivalent)
- No product/business metrics dashboard

**In-person checks**

- How does the team currently learn about production errors — user reports, Vercel logs, or something else?
- Is Vercel's built-in logging sufficient for the current scale, or are errors being missed?

**Suggested actions**

- Add Sentry (free tier covers small projects) to capture unhandled errors and performance data — the Next.js integration is a one-package install
- The `/api/health` endpoint already exists — wire it to a simple uptime monitor (e.g. Vercel's health check, UptimeRobot) to get alerted before users notice downtime
- Add structured error logging at the API layer using `src/lib/errors.ts` to ensure errors surface consistently in Vercel logs

### Responsible Testing — 5

_medium confidence · 4 positive · 5 negative · 3 in-person checks · 5 actions_

ChickensFarm has a well-structured CI pipeline with dedicated parallel jobs for lint, typecheck, and test, and the 4 unit tests that exist are high quality — covering edge cases, floating-point precision, timezone handling, and security boundaries. However, coverage is narrow (4 files for a full Next.js + Prisma app), there is no integration, E2E, or non-functional testing, no coverage threshold, and no defined testing strategy document.

**Positive signals**

- Vitest runs as a dedicated CI gate on every PR and push to `develop`, `main`, and `release` — automation is the default, not an afterthought
- CodeRabbit is configured with detailed, security-focused path instructions (multi-tenant data isolation checks, auth guard enforcement on every API route) — prevention is baked into the review workflow
- Existing tests are purposeful and precise: `finance-math.test.ts` tests floating-point edge cases, `middleware.test.ts` reads the actual source to avoid matcher drift, `notification-schedule.test.ts` tests timezone boundary behaviour
- CI jobs run in parallel with `cancel-in-progress: true` — fast feedback loop

**Negative signals**

- Only 4 test files covering 4 isolated utility modules — no tests visible for services, API routes, components, or database interactions
- `vitest run --passWithNoTests` in `package.json` means CI stays green even with zero tests — the gate does not enforce a coverage floor
- No integration tests, no E2E tests (no Playwright or Cypress config found)
- No performance or security scanning in CI (no `npm audit`, no SAST tooling)
- No testing strategy document or wiki page

**In-person checks**

- Are new features expected to ship with tests? Is this enforced in the definition of done or PR checklist?
- Is the `--passWithNoTests` flag intentional for early-stage velocity, or an oversight?
- Are there plans to add integration tests for the Prisma services layer, where multi-tenant scoping bugs would be most costly?

**Suggested actions**

- Remove `--passWithNoTests` once there is a stable test base, or add a coverage threshold via `vitest --coverage` to enforce a meaningful floor
- Add at least one integration test layer for the services in `src/lib/services/` — these handle multi-tenant data access and are the highest-risk untested area
- Add `npm audit --audit-level=high` to the CI pipeline as a lightweight security gate
- Consider adding Playwright for a smoke-level E2E test against the Vercel preview build (the `preview` CI job already waits for it — a smoke test could run against it)
- Document the team's testing approach in a `REVIEW.md` or `docs/` page — even a one-pager on what gets tested and why

## Teamwork — score −1 (low confidence)

### Collaboration & Feedback Loops — −15

_medium confidence · 2 positive · 3 negative · 2 in-person checks · 2 actions_

The CodeRabbit configuration explicitly states "This is a small solo-maintained project." There is no cross-role collaboration by definition — no testers, designers, or PMs. The only structured feedback loop is CodeRabbit's automated PR review. Confidence is medium because the solo status is confirmed from the config file.

**Positive signals**

- CodeRabbit provides an asynchronous, always-available code review feedback loop — partially substituting for peer review
- Branch-based workflow with PR reviews means changes are inspected before merging, even if by AI

**Negative signals**

- Solo-maintained: no cross-role collaboration, no peer review from a human team member
- No user feedback mechanism visible (no in-app feedback widget, no support channel referenced in the repo)
- No indication of regular demos, retrospectives, or team syncs (structurally impossible for a solo project)

**In-person checks**

- Are there any real users providing feedback on the product? How is that feedback captured and acted on?
- Is there a peer or trusted person who occasionally reviews changes or discusses direction?

**Suggested actions**

- Consider bringing in a trusted reviewer (friend, colleague) for occasional design or code reviews — even monthly async feedback can surface blind spots a solo developer misses
- Add a simple feedback mechanism in the app (e.g. a feedback link or in-app form) to create a loop with actual users

### Flow & Delivery Execution — 10

_low confidence · 3 positive · 0 negative · 2 in-person checks · 1 action_

The branch strategy (feature → develop → main → release) and automated CI gates suggest a structured delivery flow with a lightweight change approval process — peer review and CI passing is sufficient to merge. The production pipeline enforces that CI is green before any release. No sprint board, carry-over rate, or WIP data is available from the local repo.

**Positive signals**

- Branch promotion chain provides clear stages without heavyweight gates
- CI `cancel-in-progress: true` prevents stale queued runs from blocking merges
- Production release requires CI green on `main` — pipeline failures are treated as blocking

**In-person checks**

- How is work tracked day-to-day — a board, a list, or informally?
- Is there a definition of done that guides when a feature is truly complete?

**Suggested actions**

- Even a simple GitHub Projects board can make work-in-progress visible and prevent context-switching between too many half-finished features

### Outcomes over Output — 0

_low confidence · 0 positive · 0 negative · 2 in-person checks · 1 action_

No sprint goal history, backlog items, or success metrics are available from the local repo. As a solo-maintained project, the distinction between output-focused and outcome-focused working may be less formal — the builder is also the primary user, which can naturally align delivery with impact. Score is neutral by absence of evidence.

**In-person checks**

- When deciding what to build next, is the decision framed as "users need X" or "I want to build Y"?
- Are there any success metrics being tracked — even informally — such as active users, sessions, or time saved?

**Suggested actions**

- Define 1–2 measurable outcomes for the next quarter (e.g. "reduce time to record a daily egg collection to under 30 seconds") to create a feedback loop between building and impact

### Team Empowerment — 0

_low confidence · 0 positive · 0 negative · 1 in-person check_

ChickensFarm is a solo-maintained project. Team empowerment criteria — autonomy over tooling, management providing context not prescriptions, distributed decision-making — are structurally inapplicable. The builder has full autonomy over all decisions by definition, which is both the maximum and minimum expression of this criterion. Score is neutral.

**In-person checks**

- If this project ever adds a collaborator, is there a clear decision-making framework for what each person owns?

## Culture — score 11 (low confidence)

### Innovation over Predictability — 25

_low confidence · 4 positive · 0 negative · 2 in-person checks_

The technology stack demonstrates a clear bias toward innovation over stability: React 19, NextAuth v5 (beta), Tailwind CSS v4, and Next.js 16 are all pre-stable or newly released at the time of adoption. The product itself — a niche farm management app with push notifications, Prisma/Neon serverless DB, and a sophisticated release pipeline — shows ambition beyond a minimal implementation. The `AGENTS.md` file proactively warns collaborators that standard knowledge may be outdated, which is a signal of building ahead of the mainstream. Confidence is low as this reflects personal technical choices rather than an organisational culture signal.

**Positive signals**

- React 19, NextAuth v5 beta, and Tailwind v4 adopted before wide availability — comfort with uncertainty and early adoption
- Sophisticated production release pipeline (5 stages, schema safety, dry-run) built for a small project — invests in long-term quality over short-term speed
- `AGENTS.md` explicitly flags known-unknowns about the cutting-edge stack — honest acknowledgment of uncertainty
- Niche domain (Lithuanian-language farm management) shows willingness to build for an underserved problem rather than a predictable market

**In-person checks**

- Are beta/cutting-edge dependencies monitored for breaking changes? (NextAuth v5 beta in particular has had API changes between releases)
- Is the investment in the release pipeline driven by anticipation of growth, or a general quality preference?

### Learning & Continuous Improvement — 20

_low confidence · 3 positive · 0 negative · 2 in-person checks · 1 action_

The technology choices signal active engagement with the broader ecosystem: React 19, Next.js 16, Tailwind v4, and NextAuth v5 (beta) are all leading-edge adoptions requiring deliberate learning investment. The CI pipeline comments explain design rationale and explicitly call out lessons learned (e.g. why jobs are split vs. sequential, why the preview check uses the branch head SHA not the merge commit). These are indirect signals of a learning mindset. No retrospectives, team learning cadence, or skill gap tracking are applicable for a solo project.

**Positive signals**

- Adoption of React 19, NextAuth v5 beta, and Tailwind v4 before general availability — demonstrates active ecosystem engagement and willingness to learn ahead of the curve
- Pipeline comments explain the "why" behind design decisions, including past mistakes corrected (e.g. the merge commit vs. branch head SHA bug that was found and fixed)
- `AGENTS.md` warns that this Next.js version has breaking changes from training data — shows awareness of the pitfalls of outdated knowledge and actively mitigates them

**In-person checks**

- Are lessons from production incidents or surprising bugs being captured anywhere?
- Is there a deliberate process to evaluate new tools or approaches before adopting them?

**Suggested actions**

- Start a lightweight `docs/decisions.md` or `CHANGELOG.md` to capture what was tried, what was learned, and what changed — even one entry per release creates an improvement record over time

### Psychological Safety — 0

_low confidence · 0 positive · 0 negative · 1 in-person check_

Psychological safety is a team dynamic — the degree to which people feel safe to speak up, raise concerns, and admit mistakes within a group. As a solo-maintained project, there is no team context to assess. Score is neutral by structural inapplicability.

**In-person checks**

- If this project ever grows to include contributors or collaborators, creating explicit norms for how feedback is given and received will be important from the first added member.

### Trust over Control — 0

_low confidence · 0 positive · 0 negative · 1 in-person check_

Trust over Control assesses whether leadership leads with context and trust rather than oversight and control. As a solo-maintained project there is no leadership-team relationship to evaluate. Score is neutral by structural inapplicability.

**In-person checks**

- If collaborators are ever added, the existing pipeline design (CI gates, CodeRabbit review, branch protection) suggests a trust-based model — gates are automated rather than manual approval chains, which is a healthy foundation.

---

Generated by ATP portal on 2026-09-07 14:11:39 UTC. Data source: ATP evaluation files under `_data/`.
