# V1 → V2 cutover runbook

How the farm owners move from V1 (`chickensfarm`, branch `main`) to V2
(`chickensfarm-v2`, branch `v2/develop`) without losing a record, and how to go
back. Story #182; the V1 freeze switch is #239. Setup of the V2 environment is
in [`v2-environment.md`](v2-environment.md); making V2 the main app afterwards is
#183.

**Who runs it:** the owner of the GitHub repository, Vercel and Neon accounts
(the steps need all three). Plan an hour; the data steps take seconds (see the
rehearsal log), the rest is checking.

## Before the day

- [ ] V1 production runs a release with `READ_ONLY_MODE` (#239), **switched off**.
- [ ] V1 fixes are merged into `v2/develop` (`git merge origin/main` via a PR), and
      V2's production deploy of that merge is green.
- [ ] Repository secrets `NEON_API_KEY` and `VERCEL_AUTOMATION_BYPASS_SECRET` are set
      (`v2-environment.md` § 2 and § "Copying V1 data into V2").
- [ ] A rehearsal (below) passed within the last week, against the current code.
- [ ] A **dry run** of Actions → V2 data copy (target `production`) passed today.
- [ ] The owners know the time window and what to expect (step 1).

## Cutover

Go/no-go is after step 4. Until then V1 is the app of record and rolling back
costs nothing.

### 1. Announce

Tell every farm owner, ahead of the window:

- when V1 becomes read-only and for how long;
- that afterwards the same address opens the new version, and they **sign in
  again** with the same email and password (V2 has its own `AUTH_SECRET`, so V1
  sessions end);
- that phone notifications must be **switched on again** in V2 (push
  subscriptions are not copied); email reminders carry on.

### 2. Freeze V1

Vercel → `chickensfarm` → Settings → Environment Variables → Production:
`READ_ONLY_MODE` = `true`. Then Deployments → the current production deployment →
**Redeploy** (the variable is read by the running deployment's environment).

Check, on the production URL:

- every page shows "Programėlė perkeliama į naują versiją. Kol kas duomenų keisti
  negalima.";
- saving anything (e.g. a new egg collection) fails with "Programėlė perkeliama į
  naują versiją. Pakeitimų išsaugoti kol kas negalima." (`/api/*` answers 503);
- signing in and reading still work.

From here no change can reach V1, so the copy in step 3 is final.

### 3. Final migration

GitHub → Actions → **V2 data copy** → Run workflow:

- `target`: `production`
- `dry_run`: **off**

It snapshots V1 production, copies into V2 `production` in one transaction and
commits only if the copy matches V1. Download the `report.json` artifact and keep
it with the cutover notes (it holds farm ids and counts — treat it as farm data).

A red run changed nothing in V2. Read the mismatch in the job summary, stop, and
either fix and re-run or roll back (V1 is only frozen: switch it back on).

### 4. Verify (go / no-go)

- The run's summary says `OK: <n> tables, <n> farms` with no `MISMATCH` lines; the
  per-table counts match V1 (the copy checks counts, column hashes, per-farm
  money and stock itself).
- Pick one farm and compare in both apps: the year's income and expenses, bird
  count, egg stock.
- V2 `production`'s `_prisma_migrations` (Neon → SQL editor) lists every folder in
  `prisma/migrations`, none failed or rolled back. (V2's `/api/health` reports this
  only with a `CRON_SECRET`, which V2 gets in step 6.)
- Sign in to the V2 production URL (still the `chickensfarm-v2` address) as a real
  owner and open each area.

**No-go:** roll back (below). Nothing has changed for the owners yet.

### 5. Move the domain

Vercel → `chickensfarm` → Settings → Domains: remove the production domain.
Vercel → `chickensfarm-v2` → Settings → Domains: add it. Then, in
`chickensfarm-v2` → Environment Variables → Production:

- `AUTH_URL` and `APP_URL` = the production domain (they were the beta URL);

and redeploy V2 production. Password-reset links and email reminders use
`APP_URL`.

### 6. Switch reminders

Reminders are sent by the **Reminders** workflow, which calls
`vars.APP_URL/api/cron/reminders` with the `CRON_SECRET` repository secret.

- **V2** → Environment Variables → Production: set `CRON_SECRET` to the repository
  secret's value, and **remove `APP_STAGE`** from Production and Preview. `APP_STAGE`
  is what blocks V2's cron and shows the beta banner (#181).
- **In the same change** (a PR into `v2/develop`): delete the `E2E_EXPECT_BETA`
  line from `.github/workflows/ci.yml`, or every later V2 PR fails `e2e/beta.spec.ts`.
- **V1** → Environment Variables → Production: remove `CRON_SECRET`, so V1's
  endpoint answers 503 even if something still calls it.
- Repository variable `APP_URL`: the production domain (now served by V2).
- Redeploy V2 production, then run Actions → **Reminders** → Run workflow once and
  check it answers 200.

### 7. Smoke and e2e

- Actions → **Status** → Run workflow: health, version and migrations of the
  production URL.
- As a real owner, on a phone: sign in, open each area, save one harmless record
  (e.g. an egg collection) and delete it again.
- Switch phone notifications on in V2's profile screen and send the test
  notification.
- If production has the e2e user, run the signed-in e2e against it; otherwise the
  manual checks above are the e2e.

Tell the owners V2 is live. Keep V1 read-only (do not delete the project); #183
decides when it is archived.

## Rollback

Possible at any step. **Anything entered in V2 after the cutover is lost on
rollback**: V1 never received it, and nothing copies V2 back into V1. The later
you roll back, the more the owners re-enter by hand, so decide early: at step 4
at the latest, and within the first day after step 7.

1. **Domain:** move the production domain back from `chickensfarm-v2` to
   `chickensfarm` (Settings → Domains on both), and set V2's `AUTH_URL` /
   `APP_URL` back to the beta URL.
2. **Unfreeze V1:** `READ_ONLY_MODE` = `false` (or remove it) on `chickensfarm`
   Production, then redeploy.
3. **Reminders:** put `CRON_SECRET` back on V1 Production; on V2 remove
   `CRON_SECRET` and put back `APP_STAGE=beta` (Production and Preview); restore the
   `E2E_EXPECT_BETA` line in `ci.yml` if it was removed; set the repository variable
   `APP_URL` back to V1's address. Redeploy both.
4. **Tell the owners:** V1 is back; anything they entered in V2 since the cutover
   must be entered again in V1; sign in again; re-enable phone notifications in V1.
5. Leave V2's data as it is for diagnosis. The next cutover's step 3 replaces it
   anyway.

## Rehearsal

Run the data steps on throwaway Neon branches before the day. Nothing is written
to V1, and V2 `production` and `preview` are untouched.

1. **V1 snapshot:** in V1's Neon project, create a branch from `production`. On it
   only, create a SELECT-only role with plain SQL, exactly as the workflow does
   (`CREATE ROLE v1_etl_ro LOGIN PASSWORD '…' NOSUPERUSER NOCREATEDB NOCREATEROLE
NOINHERIT`, `GRANT USAGE ON SCHEMA public`, `GRANT SELECT ON ALL TABLES IN SCHEMA
public`). Roles made through the Neon API can write; do not use them.
2. **V2 target:** in V2's Neon project, create a branch from `production` (it has
   V2's schema). Check its `_prisma_migrations` lists every folder in
   `prisma/migrations` (Prisma's own `migrate status` needs port 5432, which some
   networks block; a query over Neon's driver works everywhere).
3. **Copy:** from a `v2/develop` checkout,

   ```bash
   V1_DATABASE_URL="<v1_etl_ro on the snapshot>" \
   V2_DATABASE_URL="<owner URL of the V2 rehearsal branch>" \
   npm run v2:migrate -- --dry-run --report dry.json
   # then the real run:
   npm run v2:migrate -- --report report.json
   ```

   Keep the URLs in private files, never in the shell history or a ticket.

4. **Pass:** exit 0, `OK`, no `MISMATCH`, every table's V1 and V2 counts equal, and
   the backfill checks at 0.
5. **Clean up:** delete both branches and the local URL files and reports.

### Rehearsal log

| Date       | Code (`v2/develop`) | Dry run | Copy | Result                                                                                                        |
| ---------- | ------------------- | ------- | ---- | ------------------------------------------------------------------------------------------------------------- |
| 2026-10-30 | `1411496`           | 5 s     | 12 s | **OK**: 19 tables, 5 farms, every count equal, backfill checks 0, no mismatches; target had all 17 migrations |

Counts copied in that run (rows, V1 = V2): users 3, farms 5, farm_users 5,
notification_settings 2, breeds 15, bird_groups 23, bird_group_events 45,
bird_transactions 6, bird_consumptions 2, egg_collections 126, egg_sales 22,
egg_consumptions 20, mother_hens 3, mother_hen_logs 2, incubation_cycles 11,
incubation_growth_logs 8, expenses 11, losses 8, feedback 0. Not copied:
`_prisma_migrations`, `push_subscriptions`, `password_reset_tokens`.
