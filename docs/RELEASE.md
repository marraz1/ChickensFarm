# Release process

Production runs one thing: whatever is on the `release` branch. Nothing reaches
that branch except through the **PROD_deployment** workflow, which is triggered
by hand and reports the whole release as it happens — version, build,
migrations, and a health check that the exact version published is the one being
served.

---

## Branches

```
feature/*  ──>  develop  ──>  main  ──>  release  ──>  production
```

| Branch      | Purpose                                                         | Who writes to it               |
| ----------- | --------------------------------------------------------------- | ------------------------------ |
| `feature/*` | One change at a time.                                           | You                            |
| `develop`   | Where all new work lands. Integration happens here first.       | Pull requests from `feature/*` |
| `main`      | Reviewed and green. The candidate for the next release.         | Pull requests from `develop`   |
| `release`   | **Production.** Always a fast-forward of `main`, always tagged. | **PROD_deployment only**       |

`main` stays the repository's default branch. That is deliberate: GitHub only
runs scheduled workflows from the default branch, and both `reminders.yml` and
the daily `status.yml` check depend on it.

Never push to `release` by hand. The workflow refuses to run if `release` has
commits that `main` does not, because merging over them would either conflict or
silently revert someone's work.

---

## One-time setup

1. **Vercel → Project → Settings → Git → Production Branch → `release`.**
   Until this is changed, `main` is still what goes live and the workflow will
   report that no deployment appeared.
2. **Repository secret `VERCEL_TOKEN`** — create at
   <https://vercel.com/account/tokens>. Optional, but without it the workflow
   cannot show Vercel's build output, which is where a failed migration or a
   build error actually explains itself.
3. **Repository variable `APP_URL`** and **secret `CRON_SECRET`** — already used
   by the reminder cron. The release workflow needs both to read
   `/api/health`, which is how it verifies what is live.

After step 1, pushes to `develop` and `main` produce **Preview** deployments and
only `release` reaches production.

---

## Cutting a release

1. Get the change into `main` (`feature/*` → `develop` → `main`), and let CI go
   green there.
2. **Actions → PROD_deployment → Run workflow**, with the branch set to `main`.
3. Choose the bump:
   - `patch` — fixes only (0.1.0 → 0.1.1)
   - `minor` — new features, backwards compatible (0.1.0 → 0.2.0)
   - `major` — breaking changes (0.1.0 → 1.0.0)
   - `custom` — type an exact `X.Y.Z`
4. Optionally tick **dry_run** first: every check still runs, nothing is
   pushed. Use it to see which migrations a release would apply, and to prove
   the release would succeed, before committing to it.
5. Run it, and watch the run page.

### Quality gates

Five checks run against the exact commit being released, before anything is
pushed, tagged or deployed:

| Gate                 | Runs                             | Catches                             |
| -------------------- | -------------------------------- | ----------------------------------- |
| **Lint**             | `npm run lint`                   | lint regressions                    |
| **Typecheck**        | `npm run typecheck`              | type errors                         |
| **Test**             | `npm test`                       | the unit suite                      |
| **Production build** | `npm run build`                  | prerender and route-config failures |
| **Schema checks**    | migrations + drift + safety scan | broken or destructive migrations    |

The production build matters more than it looks. Without it the build is only
proven _after_ `release` has been tagged and pushed, so a build failure leaves
a `vX.Y.Z` tag and a release branch pointing at broken code, to be unpicked by
hand.

**Schema checks** does three things against a throwaway Postgres:

1. Applies every migration to an empty database, proving they run at all before
   production tries them.
2. Diffs the result against `schema.prisma`. A difference means the schema was
   edited without a migration, so production would run code expecting a shape
   the database has not been given. Fix with `npx prisma migrate dev` and commit
   the migration.
3. Scans the migrations this release will apply for statements that destroy or
   rewrite data — `DROP TABLE`, `DROP COLUMN`, `DROP TYPE`, `TRUNCATE`,
   `ALTER COLUMN … TYPE`, `SET NOT NULL`, `RENAME`.

### Destructive migrations

If the scan finds anything, **the release is blocked** and each statement is
listed with its file and line. This is deliberate: rolling back a deployment
does not bring back a dropped column, and the currently-running code may still
be using it.

Two ways forward:

- **Split the change.** Stop writing the column in one release, drop it in a
  later one. Safe, and rollback keeps working throughout.
- **Tick `allow_destructive`** and run again, if the loss is intended and you
  have checked nothing live still depends on it.

### What the jobs prove

| Job           | What it establishes                                                                                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preflight** | Dispatched from `main`; CI green there; `release` fast-forwards cleanly; the version is free; and _which migrations this release will apply_. Nothing has been pushed yet.                                            |
| **Gates**     | Lint, Typecheck, Test, Production build and Schema checks, against the commit being released. Still nothing pushed.                                                                                                   |
| **Version**   | `package.json` bumped and committed to `main`, `release` fast-forwarded, tag `vX.Y.Z` pushed. The push to `release` is what starts Vercel.                                                                            |
| **Build**     | Watches Vercel's deployment state as it changes, and prints the build output. Fails the release if the build fails.                                                                                                   |
| **Verify**    | Polls `/api/health` until both the **version** and the **commit** match what was just published, reports exactly which migrations were applied, then smoke-tests `/login`, `/manifest.webmanifest`, `/sw.js` and `/`. |
| **Summary**   | The release drawn as a diagram, plus old → new version, tag, commit and production URL.                                                                                                                               |

A release is only successful if every one of them is.

---

## Reading a failure

### Preflight — "CI is not green on main"

Fix `main` first. The release refuses to ship code that has not passed.

### Preflight — "`release` has commits that are not on `main`"

Someone pushed to `release` directly. Bring it back before releasing:

```bash
git checkout main && git merge origin/release && git push
```

### Schema checks — "schema.prisma has changes with no migration behind them"

Someone edited the model without generating a migration. Run
`npx prisma migrate dev` locally and commit the migration it creates.

### Schema checks — "Destructive migration blocked"

See **Destructive migrations** above. Split the change, or tick
`allow_destructive` if the loss is intended.

### Verify — a smoke test failed

The deployment is live but not serving correctly. A `/sw.js` that returns 200
with an HTML content-type is the classic one: it means something is redirecting
it, and the browser will refuse to register the service worker, silently
breaking push notifications for installed apps.

### Build — "No deployment record appeared"

Vercel's Production Branch is probably still `main`. See One-time setup.

### Build — the build failed

The build output is in the run summary (with `VERCEL_TOKEN` set). Migrations run
during the production build via `vercel-build`, so a failing migration shows up
here, not in Verify.

### Verify — "production is serving a different version"

The build succeeded but the new code is not being served. Usually Vercel is
still rolling over — re-run Verify a minute later. If it persists, check the
Vercel dashboard for a promotion that did not complete.

### Verify — a migration started and never finished

Prisma refuses every later migration while a failed one exists (**P3009**), so
every subsequent release will fail until it is resolved:

```bash
DATABASE_URL="<direct-neon-url>" npx prisma migrate resolve --rolled-back <name>
```

Then fix the migration and release again.

---

## Checking what is live

- **`GET /api/health`** — unauthenticated gives liveness only; with
  `Authorization: Bearer $CRON_SECRET` it reports version, commit, database,
  applied and failed migrations, and configuration presence.
- **Profile screen** — shows the running version at the bottom. Useful on a
  phone: the app is installed to the home screen, so a stale service worker can
  keep serving an old build after a deploy.
- **Actions → Status** — the general dashboard, on demand or daily.

---

## A hazard worth knowing

Preview deployments (`develop`, `main`, pull requests) point at the **same Neon
database** as production, but migrations only run on production builds
(`vercel-build` checks `VERCEL_ENV=production`).

So a preview of a branch that adds a migration runs new code against the old
schema, and a release that applies a destructive migration changes the schema
under every existing preview. Keep migrations additive where you can, and
prefer expand-then-contract over renaming or dropping a column in one release.
