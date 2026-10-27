# V2 implementation plan

How V2 (the designs in this folder) gets built and shipped without touching the running V1
app: a separate branch, Vercel project and database, a V1→V2 data migration, cutover, and the
Epic/Story backlog on the Chickens_Farm board (#3).

## Context

`docs/V2_app_designs/` (36 artboards + README) defines V2: the farm is split into four
**areas** (Kiaušiniai ir prekyba · Perekšlės · Perinimas · Mėsiniai paukščiai) plus
"Bendra". Each area has its own records, expenses, losses and finances, and an Apžvalga
page rolls them up. V1 is live in production (`release` → Vercel → Neon), with real farms
and real data. All of V2 is planned as tracked work. V2 has to be built and run
**separately from main/V1**, on a **separate database** that is filled by a data migration,
and **V1 must never break**.

Decisions (owner, 2026-10-27):

- **Code:** a long-lived `v2/develop` branch off `main`. V2 PRs target it. A separate Vercel
  project deploys it. Fixes flow main → v2 periodically, and at cutover v2 is merged into main.
- **Data:** a new Neon database for V2 with its own migration history. An idempotent,
  re-runnable ETL copies V1 to V2 and only ever reads V1. It is rehearsed repeatedly and run
  for the last time at cutover, during a short V1 write freeze.
- **End state:** V2 replaces V1 after a beta on a V2 URL. V1 is kept as a rollback for a window.

The backlog is **4 Epics + 22 Stories** on board #3. They are created with the
`create-user-story-by-curent-code-base-and-feature-designs` skill after the AC are reviewed.

---

## Target architecture: V1 and V2 side by side

```
                 main ──(PROD_deployment)──> release ──> Vercel "chickensfarm" (V1) ──> Neon V1 (prod)
                   │  periodic merge main→v2                     ▲ ETL reads with a read-only role
                   ▼                                             │
 v2/<type>/<N>-slug ──> v2/develop ─────────> Vercel "chickensfarm-v2" (beta URL) ──> Neon V2 project
                                         previews ──> Neon V2 branch "preview" (never V1 prod)
```

Grounding facts from the code:

- `src/lib/prisma.ts` and `prisma.config.ts` read a single `DATABASE_URL`, so pointing V2 at
  its own DB is purely environment configuration. No code fork is needed.
- The V1 Vercel project is `chickensfarm` (`.vercel/project.json`) with production branch `release`.
- `vercel-build` migrates only when `VERCEL_ENV=production`. There are 13 migrations
  (`20260702143325_init` … `20260929120000_add_feedback`).
- `develop` is stale (150 behind main). In practice the flow is feature → main. V2 per-ticket
  branches follow the board workflow: `v2/<type>/<N>-slug` in a worktree under
  `C:\app\ChickensFarm-worktrees\task-<N>`, with a PR into `v2/develop`.
- Tests have no DB (`src/lib/services/fake-prisma.ts`; add new models to `MODEL_NAMES`).
  E2E covers only signed-out pages because no seeded user exists. **V2's isolated preview DB
  finally allows a seeded e2e user** (part of A1).

Rules that keep V1 safe:

1. **Nothing V2-specific lands on main before cutover.** V2 schema, migrations, ETL and UI
   live on `v2/develop`. The only V1 change is an off-by-default read-only switch (Story A5).
   It goes through the normal V1 flow and release.
2. **V1's Vercel project ignores `v2/*` branches** (Ignored Build Step in V1 project settings,
   `git branch` check). Without this, V1 previews of V2 code would run against the **V1 prod
   DB**. That shared-DB preview hazard is described in `docs/RELEASE.md` § "A hazard worth knowing".
   The V2 project ignores everything except `v2/*`.
3. **V2's environment variables never point at V1.** V2 Production uses `DATABASE_URL` and
   `DIRECT_URL` from the new Neon project. V2 Preview uses a Neon branch of the V2 DB. That
   fixes the shared-DB hazard for V2 as well. V2 also gets its own `AUTH_SECRET`/`AUTH_URL`,
   `NEXT_PUBLIC_*`, Sentry `environment=v2-beta`, its own Blob store and VAPID keys. The V2
   project has no `CRON_SECRET` reminders during the beta: `reminders.yml` runs only from main,
   and only V1 sends reminders.
4. **Migrations:** the V2 DB is built by `prisma migrate deploy` running **all** V1 migrations
   plus the V2 ones, in `vercel-build` of the V2 project. The script already gates on
   `VERCEL_ENV=production` (`package.json` `vercel-build`). V1 migrations added later arrive
   through main → v2 merges. Policy: while V2 is in flight, V1 schema changes are kept to a
   minimum and merged into v2 within a week.
5. **The ETL's V1 connection is a SELECT-only Postgres role** (`v1_etl_readonly`) on a Neon
   **branch snapshot** of V1 prod, created at run time. The ETL never touches the live V1 primary.

### Data migration design (Story A3)

- Location: `scripts/v2-migrate/` on `v2/develop` (tsx, like `prisma/seed.ts`). It uses two
  clients: a V1 reader (raw SQL or a second generated client pinned to the V1 schema) and the
  V2 Prisma client.
- **IDs are preserved** (cuid), so every relation, photo `photoUrl` (public Blob URLs keep
  working) and audit row stays intact. Users keep their `passwordHash`, so V1 credentials
  work in V2.
- **Strategy: truncate-and-reload per run** in FK order (users → farms → farm_users → breeds →
  bird_groups → … → events). It is deterministic and idempotent. V2 data during the beta is
  disposable, and a beta banner says so.
- **Transforms (V1 → V2):**
  - `Expense.area` ← `SHARED` by default. Optional heuristics: FEED/VITAMINS → the area of the
    farm's only group type when there is one. The rest is left for the owner to re-assign in V2.
  - `BirdGroup.area` ← `INC` when the group is a cycle's `resultingGroup` and is still CHICK,
    `MEAT` when it has BirdConsumption rows, otherwise `EGGS`.
  - `Loss.area`/target ← derived from `birdGroupId` → that group's area.
  - Not copied: `PushSubscription` (bound to the V1 origin), `PasswordResetToken`.
    `NotificationSetting` is copied with `lastRunOn` kept, so V2 does not resend the same day.
- **Verification report** (fails the run on mismatch): row counts per table per farm; per-farm
  money totals equal V1 (`getProfitLossReport` income and expenses for all time); bird group
  quantities and egg stock are equal; FK orphan check. Flags: `--dry-run`, `--farm <id>`,
  `--report out.json`.
- Run via a manual GitHub Action `v2-migrate.yml` (workflow_dispatch, on v2/develop, secrets
  `V1_READONLY_URL`, `V2_DIRECT_URL`), or locally.

### Cutover (Story A5, runbook `docs/v2-cutover.md`)

1. Announce. 2. V1 `READ_ONLY_MODE=true` (Vercel env + redeploy): mutating `/api/*` return 503
   with a Lithuanian message, and the UI shows a banner. 3. Final ETL plus a green verification
   report. 4. Move the production domain from the V1 to the V2 Vercel project and set V2 `AUTH_URL`.
2. Point `APP_URL` and reminders at V2. 6. Smoke tests and Playwright e2e against V2.
3. Rollback = move the domain back. V1 is intact, because it was read-only and nothing was
   written to it. Rollback window: 14 days. After cutover there is no reverse sync, so a
   rollback loses V2 writes (accepted, and stated in the runbook).
4. Story A6: merge `v2/develop` → main, point PROD_deployment/`release` at the V2 project,
   archive the V1 project and DB after the window.

---

## Backlog

Board: user project #3, all items in Backlog, label `epic`/`story`, assignee marraz1.
Markers follow `<!-- feature-stories:v1 id=... -->`. No existing V2 epics/stories exist; the
only related item is #157 "Mark bird groups as used for meat/food consumption", which is closed
and implemented as `BirdConsumption`.

### Epic A — V2 platform, separate database & data migration

| #   | Story                                                                                                                                                                                                                                                                                                                        | P   | Size | Depends |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---- | ------- |
| A1  | V2 beta environment runs separately from V1 (branch `v2/develop` + protection, Vercel project `chickensfarm-v2`, Neon V2 DB + preview branch, env isolation, V1 Ignored Build Step for `v2/*`, `ci.yml` push trigger for `v2/develop`, seeded e2e user + signed-in smoke on V2 preview, `DIRECT_URL` in `.env.example`)      | P0  | M    | —       |
| A2  | Farm data is organised into areas (schema: `FarmArea` enum EGGS/HENS/INC/MEAT/SHARED; `Expense.area` + optional target (birdGroupId/motherHenId/incubationCycleId); `BirdGroup.area`; `Loss.motherHenId`/`incubationCycleId`; `MotherHen.diedAt`; new categories per open Q) — services, Zod, tenant checks, isolation tests | P0  | L    | A1      |
| A3  | Farm owner's V1 data appears in V2 (re-runnable ETL + verification report + manual workflow)                                                                                                                                                                                                                                 | P0  | L    | A2      |
| A4  | Farmer can sign in to V2 beta with V1 account (beta banner "Beta: duomenys gali būti perrašyti", Sentry env, reminders off, version on profile)                                                                                                                                                                              | P1  | S    | A1, A3  |
| A5  | Farm owners move to V2 without data loss (V1 read-only switch — V1 ticket via the normal flow; cutover runbook; rehearsal on a Neon branch)                                                                                                                                                                                  | P0  | M    | A3      |
| A6  | V2 becomes the main app (merge v2→main, release pipeline, retire V1 project/DB after the window)                                                                                                                                                                                                                             | P1  | S    | A5      |

### Epic B — V2 navigation & farm areas

| #   | Story                                                                                                                                                                                | P   | Size | Depends |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ---- | ------- |
| B1  | Farmer navigates by farm area (V2Nav Apžvalga/Kiaušiniai/Perekšlės/Perinimas/Mėsa, V2Tabs, V2Header; no "+" FAB; reused V1 screens rendered in the V2 shell; route map)              | P0  | M    | A1      |
| B2  | Bird groups belong to Kiaušiniai or Mėsa (group form area field; "Dedeklių grupės"/"Mėsinių grupės" filtered lists; Trade-Form preset type + area; hatch-created groups → Perinimas) | P0  | M    | A2, B1  |
| B3  | Eggs area overview & "Naujas" sheet (Kiaušinių likutis, Dedeklių pulkas, Balansas; Įrašai links; 6 actions + Nauja išlaida / Registruoti nuostolį)                                   | P1  | M    | B1, B2  |
| B4  | Mother hens area overview & "Nauja" sheet (Perekšlės, Peri dabar, photo cards, "Pradėti perėjimą su perekšle" → Inc-New)                                                             | P1  | S    | B1      |
| B5  | Incubation area overview & "Naujas ciklas" (Aktyvūs ciklai, Efektyvumas = hatched/fertile, cycle cards with status badge)                                                            | P1  | M    | B1      |
| B6  | Meat area overview & "Naujas" sheet (Auginama mėsai, Suvartota mėsai, Paskutiniai įrašai)                                                                                            | P1  | S    | B1, B2  |

### Epic C — V2 area expenses, losses & finances

| #   | Story                                                                                                                                                                                                                            | P   | Size | Depends |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---- | ------- |
| C1  | Farmer records an expense for an area (V2ExpenseForm, area pre-filled, optional target, "Išsaugoti")                                                                                                                             | P0  | M    | A2, B1  |
| C2  | Farmer records a shared or other-area expense from the overview (V2-Expense-Form radio incl. "Bendra (visam ūkiui)")                                                                                                             | P1  | S    | C1      |
| C3  | Farmer sees an area's expenses (Išlaidos tab: total + category breakdown, rows, bird purchases as derived rows → Trade-Purchases)                                                                                                | P0  | M    | C1      |
| C4  | Farmer records a loss against a group, hen or cycle (V2LossForm: target required, Liga/Plėšrūnas/Kita; group → `adjustBirdGroupQuantityTx`; hen → marked dead; cycle → alive chicks reduced)                                     | P0  | L    | A2, B1  |
| C5  | Farmer sees an area's losses (Nuostoliai tab: count by cause, rows, empty state "Šiais metais perekšlių nuostolių nebuvo.")                                                                                                      | P0  | M    | C4      |
| C6  | Area-specific loss insights (Eggs "Sudaužyti kiaušiniai" from collections; Inc "Neapvaisinti"/"Apvaisinti, bet neišsirito"; Meat "Prarasta pašarų vertė ≈"; Hens broken eggs — open Q)                                           | P2  | M    | C5      |
| C7  | Farmer sees an area's finances (Finansai tab: Pelnas/Nuostolis, period switch, income by source rule 4, categories, Pagal mėnesius, "Visi ūkio finansai") — shared `getAreaFinance` service in integer cents (`finance-math.ts`) | P0  | L    | C3      |
| C8  | Area unit economics (Pelno marža, cost per hatched chick, cost per meat bird, per hen, meat home use count)                                                                                                                      | P2  | S    | C7      |

### Epic D — V2 farm overview (Apžvalga)

| #   | Story                                                                                                                              | P   | Size | Depends |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | --- | ---- | ------- |
| D1  | Farm result for a period (Pelnas/Nuostolis, Pajamos/Išlaidos, Šis mėn./2026 m./Laikotarpis; areas + Bendros sum to total — rule 7) | P0  | M    | C7      |
| D2  | Spending/income by area donut (Išlaidos/Pajamos toggle, fixed area colours, tap-to-focus, % labels for contrast)                   | P1  | M    | D1      |
| D3  | Expandable area tiles (one open at a time; top categories, losses, last 3 months, "Atidaryti sritį"/"Finansai")                    | P1  | M    | D1, C5  |
| D4  | "Ūkis dabar" KPIs & "Daugiau statistikos" (collapsed by default)                                                                   | P2  | S    | D1      |

Every story gets full AC when the skill runs: happy path, validation, empty state, tenant
isolation (another farm's targets are rejected with 400 and never shown), effect on totals,
and Lithuanian copy quoted from the artboards.

### Deliberately not given stories (listed under "Already in the app" in the Epics)

The 22 V1 screens the README lists as "reused unchanged" (Egg-new, Eggs-Sales-_, Trade-_,
Groups-_, Hens-_, Inc-_, Meat-_, Profile-Home): V2 only wraps them in the shell (B1).
`BirdConsumption` (meat use), `adjustBirdGroupQuantityTx`, `getProfitLossReport` and
`finance-math` cents helpers are reused as they are.

Conventions every V2 story's AC assumes: services take `farmId` first, with `{id, farmId}`
lookups and cross-link checks (`docs/architecture.md` "Adding a farm-scoped feature"); route
handlers use `requireActiveFarmApi` → zod → service → `handleApiError`; new enums get Lithuanian
labels in `src/lib/labels.ts`; new query cases are added to `multi-tenant-isolation.test.ts`;
money is summed in cents via `src/lib/finance-math.ts`; dates are `@db.Date` in UTC.

### Open questions (go into Epic bodies)

1. Expense categories in the designs that are missing from the enum: "Elektra", "Tvoros ir
   remontas". Add enum values, or keep them as OTHER plus a description?
2. Hen area losses: is "Sudaužyti perinti kiaušiniai" a new MotherHenLog field?
3. Inc loss: does it reduce the resulting group via `adjustBirdGroupQuantityTx`, or write a growth log?
4. Not designed: edit screens, dark mode, list empty states, the loss-form area chooser
   outside an area. Proposal: V1 behaviour for edits, the rest later.
5. Expense area backfill heuristics in the ETL. Default is everything → Bendra.
6. Out of scope, noted only: the WORKER role is not enforced on farm-scoped routes, and
   `src/middleware.ts` → `proxy.ts` rename (Next 16). Both are V1 known gaps and are not V2 scope.

---

## Backlog status

Not yet on the board. When the Epics and Stories are created, their issue numbers replace
A1…D4 above. Order of creation: Epic → board (Backlog) → each Story linked as a sub-issue
with Priority/Size/Estimate → each Epic's `## Stories` checklist. Branches and Vercel/Neon
resources are the work of Story A1, not of backlog creation. This plan file is docs only and
safe on main: the "nothing V2 on main" rule covers code, schema and migrations.

## Verification

- `gh project item-list 3 --owner marraz1` shows 26 new items in Backlog with Priority/Size.
- `gh api repos/marraz1/ChickensFarm/issues/<epic>/sub_issues` lists each Epic's stories.
- Every body starts with the `feature-stories:v1` marker. A re-run creates nothing new.
- Architecture check against the codebase: `package.json` `vercel-build` gating,
  `src/lib/prisma.ts` (single `DATABASE_URL`, so env isolation is enough and no code fork is
  needed), `.github/workflows/ci.yml` triggers (add `v2/**`).
