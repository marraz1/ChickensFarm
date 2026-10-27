# V2 beta environment

How V2 runs next to V1 without touching it (issue #178, plan:
[`V2_app_designs/V2-implementation-plan.md`](V2_app_designs/V2-implementation-plan.md)).

```
main ──(PROD_deployment)──> release ──> Vercel "chickensfarm"    ──> Neon V1 (prod)
v2/<type>/<N>-slug ──> v2/develop ────> Vercel "chickensfarm-v2" ──> Neon V2 project
                       PR previews ────> Vercel "chickensfarm-v2" ──> Neon V2 branch "preview"
```

| Rule                                                         | Where it is enforced                                  |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| V2 code never lands on `main` before cutover                 | PRs target `v2/develop`; ruleset on `v2/develop`      |
| V1 project never builds `v2/*` (its previews use V1 prod DB) | V1 project → Ignored Build Step                       |
| V2 project builds only `v2/*`                                | V2 project → Ignored Build Step                       |
| V2 never reads or writes the V1 database                     | V2 project env vars point only at the V2 Neon project |
| V2 migrations run only against V2                            | `vercel-build` (production builds of the V2 project)  |

Nothing in this setup changes V1's code, settings (apart from the Ignored Build Step) or database.

---

## One-time setup

Steps 1–5 are done by hand in the Neon, Vercel and GitHub dashboards.

### 1. Neon: a separate project for V2

1. Neon console → **New project** `chickensfarm-v2`, same region as V1.
   A separate _project_, not a branch of V1: no shared roles, no shared storage.
2. In it, create a branch **`preview`** from the default branch (`production`). V2 PR previews use it, so they never
   share a database with V2 production either (the hazard in `docs/RELEASE.md` § "A hazard
   worth knowing" does not carry over to V2).
3. Copy for each branch: the pooled URL (`DATABASE_URL`) and the direct URL (`DIRECT_URL`).

### 2. Vercel: the `chickensfarm-v2` project

1. **Add New → Project →** import `marraz1/ChickensFarm` again, name `chickensfarm-v2`.
2. **Settings → Git → Production Branch:** `v2/develop`.
3. **Settings → Git → Ignored Build Step → Custom command** (exit 1 = build, 0 = skip):

   ```bash
   [[ "$VERCEL_GIT_COMMIT_REF" == v2/* ]] && exit 1 || exit 0
   ```

   Also make sure the project **creates GitHub deployments** (project setting
   `gitProviderOptions.createDeployments = enabled`). A newly imported project had it
   disabled, so CI's preview job found no deployment record and waited until it was
   cancelled.

4. **Settings → Environment Variables:**

   | Variable                                                | Production                                       | Preview                 |
   | ------------------------------------------------------- | ------------------------------------------------ | ----------------------- |
   | `DATABASE_URL`                                          | V2 `production` pooled URL                       | V2 `preview` pooled URL |
   | `DIRECT_URL`                                            | V2 `production` direct URL                       | V2 `preview` direct URL |
   | `AUTH_SECRET`                                           | new value (`openssl rand -base64 32`), not V1's  | same as Production      |
   | `AUTH_URL`                                              | the beta URL                                     | unset                   |
   | `APP_URL`                                               | the beta URL                                     | unset                   |
   | `BLOB_READ_WRITE_TOKEN`                                 | token of a new Blob store `chickensfarm-v2`      | same                    |
   | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`                | new pair (see `.env.example`)                    | same                    |
   | `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`                 | same as V1                                       | same                    |
   | `SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `v2-beta`                                        | `v2-preview`            |
   | `RESEND_API_KEY` / `EMAIL_FROM`                         | same as V1 (password reset)                      | same                    |
   | `CRON_SECRET`                                           | **unset** — no reminders from V2 during the beta | unset                   |

   Never paste a V1 database URL into this project.

5. **Settings → Deployment Protection → Protection Bypass for Automation:** generate a secret
   and store it as the repository secret `VERCEL_AUTOMATION_BYPASS_SECRET`. Without it CI's
   e2e job gets Vercel's SSO redirect, prints a warning and skips every test. V1 PRs send the
   same header, which simply does not match V1's protection, so they behave as before.

### 3. Vercel: make V1 skip V2 branches

V1 project `chickensfarm` → **Settings → Git → Ignored Build Step → Custom command**:

```bash
[[ "$VERCEL_GIT_COMMIT_REF" == v2/* ]] && exit 0 || exit 1
```

This is the only change to V1. Without it, every V2 PR would also get a V1 preview build
running V2 code against the **V1 production database**.

### 4. Seed the e2e user on the V2 preview branch

```bash
SEED_TARGET=v2-preview \
DATABASE_URL="<V2 preview direct URL>" \
E2E_USER_EMAIL="e2e@<your domain>" E2E_USER_PASSWORD="<12+ chars>" \
npm run db:seed:e2e
```

The preview branch must have the schema first, because preview builds do not migrate.
Let the first `v2/develop` deploy migrate `production`, then in Neon **reset `preview` from
its parent** (`production`). That copies the tables and the `_prisma_migrations` history. Do
the same after any merge that adds a migration, and re-run the seed afterwards, because
a reset discards preview's data, including the e2e user.

### 5. GitHub

- Repository secrets `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` (same values as step 4). CI
  passes them to Playwright only for PRs into `v2/*` (`.github/workflows/ci.yml`, e2e job), so
  V1 previews never try to sign in against production.
- Ruleset on `v2/develop`: no deletion, no force-push, require a pull request and the `CI`
  check.

---

## Day to day

- Story branches: `v2/<type>/<N>-slug` from `v2/develop`, PR into `v2/develop` with
  `Closes #N`. CI runs the same gates as V1; the preview job waits for the
  `chickensfarm-v2` deployment, then e2e runs the signed-out and signed-in smoke against it.
- A merge into `v2/develop` deploys the beta and runs `prisma migrate deploy` against the V2
  database only.
- Bring V1 fixes across regularly: `git checkout v2/develop && git merge origin/main` (via a
  PR). V1 migrations then apply to V2 on the next beta deploy.

## Checking the separation

- V1 `GET /api/health` (with `CRON_SECRET`) reports the same version, commit and migrations
  before and after the V2 setup.
- A V2 PR shows a `chickensfarm-v2` preview and a skipped (canceled) `chickensfarm` build.
- In Neon, V1's database shows no connections from the V2 project's deployments.
- Sentry shows V2 events under `v2-beta` / `v2-preview` only.
