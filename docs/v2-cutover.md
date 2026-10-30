# V1 → V2 cutover runbook

How the farm owners move from V1 to V2 without losing a record, how V1 stays
live next to it, and how to go back. Stories #182 and #245; the V1 freeze switch
is #239. Each app has its own release line (`docs/RELEASE.md`) and its own
environment (`v2-environment.md`).

| After the cutover | V1                                          | V2                                               |
| ----------------- | ------------------------------------------- | ------------------------------------------------ |
| Address           | `https://chickensfarm-v1.vercel.app` (new)  | `https://chickensfarm.vercel.app` (owners')      |
| Released by       | PROD_deployment (`main_app_V1` → `release`) | PROD_deployment_V2 (`main_app_V2` → `releaseV2`) |
| Database          | V1's own                                    | V2's own, filled by the final copy               |
| Reminders         | **off** (`REMINDERS_V1=off`)                | **on** (`REMINDERS_V2=on`)                       |
| Status            | daily, on its own address                   | daily, on its own address                        |

The owners' address moves to V2, so bookmarks and installed home-screen apps open
the new app with nothing to do. V1 stays reachable on its own address. **From
the final copy on, the two apps' data is separate: nothing is ever synced
between them, in either direction.** Only V2 sends reminders, so nobody gets two
of each.

**Who runs it:** the owner of the GitHub repository, Vercel and Neon accounts
(the steps need all three). Plan an hour; the data steps take seconds (see the
rehearsal log), the rest is checking.

## Before the day

- [ ] V1 production runs a release with `READ_ONLY_MODE` (#239), **switched off**.
- [ ] V1 fixes are merged into `v2/develop` (`git merge origin/main_app_V1` via a
      PR), promoted to `main_app_V2`, and **released with PROD_deployment_V2**.
      Status is green for both apps.
- [ ] **V1's new address works:** Vercel → `chickensfarm` → Settings → Domains → add
      `chickensfarm-v1.vercel.app`, and check that `https://chickensfarm-v1.vercel.app/login`
      answers 200. Owners notice nothing; their address is unchanged.
- [ ] Repository variables `REMINDERS_V1` = `on`, `REMINDERS_V2` = `off` (or unset),
      and `V2_CUTOVER_DONE` unset. An app sends reminders only while its variable
      is exactly `on`.
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

- when the app becomes read-only and for how long;
- that afterwards **the same address opens the new version**, and they **sign in
  again** with the same email and password (V2 has its own `AUTH_SECRET`, so old
  sessions end);
- that **reminders pause** during the window, and that phone notifications must be
  **switched on again** in the new app (push subscriptions are not copied);
- that the old version stays available at `https://chickensfarm-v1.vercel.app`, but
  **anything entered there after the move is not in the new app**.

Tell the V2 beta testers too: stay out of V2 from step 3 until step 8. The final
copy empties and reloads every V2 table, so anything they entered is replaced,
and their requests wait behind the copy's locks.

### 2. Freeze V1

1. Repository variable **`REMINDERS_V1` = `off`**, so the Reminders workflow stops
   calling V1. A reminder sent now would write its claim to V1 after the copy, and
   V2 would send it again. Then wait until Actions → Reminders shows **no run in
   progress or queued**: a run triggered before the change still calls V1. (Frozen
   V1 would refuse a late one, which only turns that run red.)
2. Vercel → `chickensfarm` → Settings → Environment Variables → Production:
   `READ_ONLY_MODE` = `true`. Then Deployments → the current production deployment
   → **Redeploy**. Redeploy rebuilds, which the switch needs: the sign-in page is
   prerendered with or without the banner, and a running deployment keeps the
   environment it started with. A promote or an instant rollback does not pick up
   the change.

Check, on `https://chickensfarm.vercel.app`:

- every page shows "Programėlė perkeliama į naują versiją. Kol kas duomenų keisti
  negalima.";
- saving anything (e.g. a new egg collection) fails with "Programėlė perkeliama į
  naują versiją. Pakeitimų išsaugoti kol kas negalima.": every change through
  `/api/*` answers 503, registration and password resets included;
- signing in, reading and switching farms still work (and `/api/health` answers).

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
- Actions → **Status** → Run workflow: the **V2** section is green, including
  Migrations (V2's live database against `releaseV2`).
- Sign in to V2 (still `https://chickensfarm-v2.vercel.app`) as a real owner and
  open each area.

**No-go:** roll back (below). Nothing has changed for the owners yet.

### 5. Move the address

Do the two halves back to back: a `vercel.app` name that is released can be
claimed by anyone.

1. Vercel → `chickensfarm` → Settings → Domains: remove `chickensfarm.vercel.app`.
2. Vercel → `chickensfarm-v2` → Settings → Domains: add `chickensfarm.vercel.app`.
3. Environment Variables → Production on each project:
   - `chickensfarm-v2`: `AUTH_URL` and `APP_URL` = `https://chickensfarm.vercel.app`
     (they were the beta URL);
   - `chickensfarm`: `AUTH_URL` and `APP_URL` = `https://chickensfarm-v1.vercel.app`.
     Without this, signing in to V1 redirects to the owners' address, which is now
     V2.
4. **End V2's beta in the same change**, so owners never see the beta banner on
   their address: on `chickensfarm-v2` remove `APP_STAGE` from Production and
   Preview (it shows the banner "Beta: duomenys gali būti perrašyti" and blocks
   V2's cron, #181), and set `SENTRY_ENVIRONMENT` and
   `NEXT_PUBLIC_SENTRY_ENVIRONMENT` (Production) from `v2-beta` to `production`.
5. Repository variables: `APP_URL` = `https://chickensfarm-v1.vercel.app` (V1) and
   `APP_URL_V2` = `https://chickensfarm.vercel.app` (V2). Reminders, Status and
   both release workflows read these.
6. **Redeploy both** production deployments (Deployments → current production →
   Redeploy), once, so they pick up all of the above.

Password-reset links and email reminders use `APP_URL`.

### 6. Reminders to V2

V2 left the beta in step 5, so its cron now accepts the batch.

1. Delete the `E2E_EXPECT_BETA` line from `.github/workflows/ci.yml` (a PR into
   `v2/develop`, then `v2/develop` → `main_app_V2`), or every later V2 PR fails
   `e2e/beta.spec.ts`.
2. Repository variable **`REMINDERS_V2` = `on`** (`REMINDERS_V1` stays `off`).
3. Actions → **Reminders** → Run workflow once: `V2 reminders` is green and
   `V1 reminders` is skipped. V2 already has its `CRON_SECRET` (the repository
   secret `CRON_SECRET_V2`, #243). Reminders resume from here, from V2 only.

### 7. Unfreeze V1 on its own address

Vercel → `chickensfarm` → Environment Variables → Production: `READ_ONLY_MODE` =
`false` (or remove it), then **Redeploy**.

Then repository variable **`V2_CUTOVER_DONE` = `true`**. From now on the V2 data
copy refuses `target: production`: a copy would empty V2 and reload it from V1,
deleting everything owners entered in V2. (Run that workflow only from the
default branch, `main_app_V2`, whose copy has this guard; `main_app_V1` keeps an
older copy without it.)

V1 is live again on `https://chickensfarm-v1.vercel.app`, with its own database,
and still released by PROD_deployment. It sends no reminders. **Anything entered
in V1 from now on stays in V1** — it is not in V2, and nothing will ever copy it
there.

### 8. Smoke and Status

- Actions → **Status** → Run workflow: **V1 and V2 both green**, each on its new
  address (V2's version is what PROD_deployment_V2 last released).
- As a real owner, on a phone, from the home-screen app: it opens V2; sign in, open
  each area, save one harmless record (e.g. an egg collection) and delete it again.
- Switch phone notifications on in V2's profile screen and send the test
  notification.
- Open `https://chickensfarm-v1.vercel.app` and sign in: V1 works, with no banner.

Tell the owners the new app is live.

## Rollback

Possible at any step. **Anything entered in V2 after the cutover is lost on
rollback**: V1 never received it, and nothing copies V2 back into V1. Anything
entered in V1 on its own address after step 7 is kept — V1 is the same app
throughout. The later you roll back, the more the owners re-enter by hand, so
decide early: at step 4 at the latest, and within the first day after step 8.

1. **Address:** back to back, remove `chickensfarm.vercel.app` from
   `chickensfarm-v2` and add it to `chickensfarm`. Set V1's `AUTH_URL` / `APP_URL`
   back to `https://chickensfarm.vercel.app` and V2's back to
   `https://chickensfarm-v2.vercel.app`; repository variables `APP_URL` and
   `APP_URL_V2` likewise.
2. **Unfreeze V1** if it is still frozen (rollback before step 7):
   `READ_ONLY_MODE` = `false` on `chickensfarm` Production.
3. **Reminders and beta:** `REMINDERS_V2` = `off`, `REMINDERS_V1` = `on`, and
   remove `V2_CUTOVER_DONE`. On V2 put back `APP_STAGE=beta` (Production and
   Preview) and the Sentry environment `v2-beta`. If step 6 removed the
   `E2E_EXPECT_BETA` line, restore it the same way: a PR into `v2/develop`, then
   promoted to `main_app_V2`. **V1 will resend that day's reminders** on its next
   run: V1's last claims are from the freeze, and V2's stay in V2. After a rollback
   on a later day, only that day's are resent.
4. **Redeploy both** production deployments.
5. **Tell the owners:** the old version is back on the usual address; anything they
   entered in the new app since the cutover must be entered again; sign in again;
   re-enable phone notifications.
6. Leave V2's data as it is for diagnosis. A rolled-back cutover is not a cutover:
   the next attempt starts from the top, and its step 3 replaces V2's data.

## Rehearsal

Run the data steps on throwaway Neon branches before the day. Nothing is written
to V1, and V2 `production` and `preview` are untouched.

1. **V1 snapshot:** in V1's Neon project, create a branch from `production`. On it
   only, create a SELECT-only role with plain SQL, exactly as the workflow does
   (`CREATE ROLE v1_etl_ro LOGIN PASSWORD '…' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`,
   `GRANT USAGE ON SCHEMA public`, `GRANT SELECT ON ALL TABLES IN SCHEMA public`).
   Roles made through the Neon API can write; do not use them.
2. **V2 target:** in V2's Neon project, create a branch from `production` (it has
   V2's schema). Check its `_prisma_migrations` lists every folder in
   `prisma/migrations` (Prisma's own `migrate status` needs port 5432, which some
   networks block; a query over Neon's driver works everywhere).
3. **Copy:** from a `v2/develop` checkout,

   Save the two URLs in private files first (here `v1.url` holds the read-only
   role on the snapshot, `v2.url` the owner URL of the V2 rehearsal branch), so
   they never appear in the shell history or a ticket:

   ```bash
   V1_DATABASE_URL="$(cat v1.url)" V2_DATABASE_URL="$(cat v2.url)" \
     npm run v2:migrate -- --dry-run --report dry.json
   # then the real run, with the same variables:
   V1_DATABASE_URL="$(cat v1.url)" V2_DATABASE_URL="$(cat v2.url)" \
     npm run v2:migrate -- --report report.json
   ```

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
