# ChickensFarm

Mobile-first poultry farm management for small farms — birds, eggs, incubation,
losses and finances in one place. The interface is in **Lithuanian**; the code and
documentation are in English.

One account can own or belong to several farms, and each farm keeps its own data.
Everything is designed around a phone: a bottom tab bar, a central "+" button for
quick entry, and screens that stay usable with one hand in a coop.

---

## What it does

| Module              | Screens                                                                   | What you track                                                                                          |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Dashboard**       | `/`                                                                       | Bird count by type, egg balance, monthly income vs. expenses, active incubation cycles, latest activity |
| **Birds**           | `/birds`, `/bird-groups`, `/breeds`                                       | Bird groups by category and sex, breeds, group events, growth                                           |
| **Eggs**            | `/eggs/collections`, `/eggs/sales`, `/eggs/consumptions`, `/eggs/reports` | Daily collections with quality, sales, home consumption, period reports                                 |
| **Incubation**      | `/incubation`                                                             | Incubation cycles, candling, hatch results, growth logs, finishing a cycle                              |
| **Mother hens**     | `/mother-hens`                                                            | Broody hens, their logs and photos                                                                      |
| **Losses**          | `/losses`, `/losses/reports`                                              | Losses by reason, with reporting                                                                        |
| **Finance**         | `/finance`, `/expenses`, `/expenses/reports`                              | Expenses by category, income from egg sales, balance                                                    |
| **Farms & profile** | `/farms`, `/profile`                                                      | Multiple farms, farm settings, members and roles                                                        |

Authentication is email + password with password reset by email.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **TypeScript**, **Tailwind CSS v4**, **shadcn/ui** on Base UI, **lucide-react** icons
- **Prisma 7** with the **Neon** serverless Postgres driver adapter
- **Auth.js (NextAuth v5)** — credentials provider, JWT sessions, Edge middleware
- **Resend** for password-reset email, **Vercel Blob** for mother-hen photos
- **Zod** + **react-hook-form** for validation on both sides of every form

---

## Getting started

**Requirements:** Node.js **20.9+** (Next.js 16 minimum) and a Postgres database —
[Neon](https://neon.tech) is what this project targets.

```bash
# 1. Install dependencies (runs `prisma generate` afterwards)
npm install

# 2. Configure the environment
cp .env.example .env
# then fill in DATABASE_URL and AUTH_SECRET

# 3. Create the database schema
npx prisma migrate dev

# 4. Optional: load demo data (one farm with birds, eggs, expenses)
npm run db:seed

# 5. Run it
npm run dev
```

Open <http://localhost:3000>. Register a new account, or — if you seeded —
sign in with **demo@chickensfarm.lt** / **password123**.

### Environment variables

| Variable                | Required | Purpose                                                                                                                                    |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`          | yes      | Neon Postgres connection string. Use the **unpooled/direct** URL so `prisma migrate` works reliably.                                       |
| `AUTH_SECRET`           | yes      | Auth.js signing secret — generate with `openssl rand -base64 32`.                                                                          |
| `RESEND_API_KEY`        | no       | Sends password-reset email. Unset in development, reset links are printed to the server console instead.                                   |
| `EMAIL_FROM`            | no       | Sender address for those emails.                                                                                                           |
| `BLOB_READ_WRITE_TOKEN` | no       | Vercel Blob token for mother-hen photo upload.                                                                                             |
| `CRON_SECRET`           | no       | Shared token for `POST /api/cron/reminders`. Unset means the endpoint returns 503 and no reminders are sent.                               |
| `APP_URL`               | no       | Absolute base URL for links inside reminder emails. Falls back to `VERCEL_PROJECT_PRODUCTION_URL`; if neither is set, the link is omitted. |
| `VAPID_PUBLIC_KEY`      | no       | Web-push key pair, self-generated (see `.env.example`). Unset means the phone toggle is disabled and no push is sent.                      |
| `VAPID_PRIVATE_KEY`     | no       | The private half. Never sent to the browser.                                                                                               |
| `VAPID_SUBJECT`         | no       | Contact URI for the push services — `mailto:` or `https://`. Falls back to `APP_URL` when that is https.                                   |

### Scripts

| Command                     | What it does                                                |
| --------------------------- | ----------------------------------------------------------- |
| `npm run dev`               | Development server on port 3000                             |
| `npm run build`             | Production build                                            |
| `npm run vercel-build`      | What Vercel runs: migrates first on production, then builds |
| `npm start`                 | Serve the production build                                  |
| `npm run lint`              | ESLint                                                      |
| `npm run db:seed`           | Seed demo data (`prisma/seed.ts`)                           |
| `npx prisma migrate dev`    | Apply migrations locally and regenerate the client          |
| `npx prisma migrate deploy` | Apply migrations in production                              |
| `npx prisma studio`         | Browse the database                                         |

---

## Install it as an app (PWA)

ChickensFarm ships a web manifest and app icons, so it can be added to a phone's
home screen or a desktop dock and then opens in its own window — no browser
address bar, and it appears in the app switcher like any other app.

Install from the **deployed URL over HTTPS**. `localhost` works for testing;
plain `http://` on another host does not.

### iPhone / iPad (iOS, iPadOS)

Installing is only possible from **Safari** — Chrome and Firefox on iOS cannot add
web apps to the home screen.

1. Open the site in Safari.
2. Tap the **Share** button (the square with an arrow, in the bottom or top bar).
3. Scroll down and tap **Add to Home Screen**.
4. Confirm the name (**ChickensFarm**) and tap **Add**.

The chicken icon appears on the home screen and the app opens full screen.
Sign-in is remembered separately from Safari, so you log in once inside the app.

### Android

Works in **Chrome**, **Edge**, **Samsung Internet**, and other Chromium browsers.

1. Open the site.
2. Tap the **⋮** menu.
3. Tap **Install app** or **Add to Home screen** and confirm.

Chrome may also offer an install banner at the bottom of the screen. Android uses
the maskable icon, so the chicken stays inside the circular or squircle mask your
launcher applies.

### Desktop (Chrome, Edge)

1. Open the site.
2. Click the **install icon** in the address bar (a monitor with an arrow), or open
   the **⋮** / **···** menu and choose **Install ChickensFarm…** / **Apps → Install
   this site as an app**.
3. The app gets its own window, a taskbar/dock icon, and a Start-menu entry.

To remove it: open the app window's **⋮** menu → **Uninstall**.

### Safari on macOS

Safari 17 or newer: open the site, then **File → Add to Dock…**. The app opens as a
standalone window and shows up in Launchpad.

### Firefox

Firefox on desktop does not install web apps. On Android, Firefox offers
**Install** in its menu. Everything works in the browser tab either way —
installing only changes how the app is launched and framed.

### Current limitations

There is now a service worker (`public/sw.js`), but it handles **push only** —
`push`, `notificationclick`, and a passthrough `fetch` listener. It does **no
caching**, so the app is still online-only and has no background sync.

Note the install-prompt wording is not something the service worker fixes:
current Chromium does not require a fetch handler to offer _Install app_, so if
your browser shows _Add to Home screen_ instead, the cause lies elsewhere. The
manual steps above work regardless.

## Daily reminders

A user can configure one daily reminder at **Profilis → Pranešimai**: on/off, the
message text, and the time of day in their own time zone. It is sent only if no
egg collection has been recorded that day, in any farm the user belongs to — so
entering data on time means silence.

Two delivery channels can be on independently — **El. paštu** and **Telefone** —
so a reminder can arrive as both a notification and a durable email record.

Push is **per device, not per account**. The Telefone toggle registers the
browser you are holding; a phone and a laptop are two separate registrations, and
turning the toggle on again on a second device adds it rather than moving it.
Because of that, the toggle also persists the preference immediately rather than
waiting for **Išsaugoti** — otherwise granting permission and then navigating away
would leave push silently off. On iOS this only works once the app has been added
to the home screen (16.4+); the toggle explains that when it detects it.

Dead registrations prune themselves: a push service answering `404`/`410` means
the app was uninstalled or site data cleared, and that row is deleted. Nothing
else deletes a subscription — notably `403`, which is what a mis-rotated VAPID key
returns, is treated as a bug to investigate rather than a dead device.

Delivery is driven by `.github/workflows/reminders.yml`, which POSTs to
`/api/cron/reminders` every 15 minutes with `Authorization: Bearer $CRON_SECRET`.
GitHub Actions is used rather than Vercel Cron because Vercel's Hobby plan only
allows a once-per-day schedule. The schedule runs in UTC; per-user local time is
resolved by the app, and a reminder is delivered up to 2 hours late to absorb
scheduler drift, after which it is skipped until the next day.

Setup, in order:

1. `npx prisma migrate deploy` (the `notification_settings` table).
2. Set `CRON_SECRET` and `APP_URL` in Vercel → Production, then deploy.
3. Add the repository **secret** `CRON_SECRET` (same value) and the repository
   **variable** `APP_URL` under Settings → Secrets and variables → Actions.
   `APP_URL` is the app's own origin — `https://example.vercel.app`, not a
   vercel.com dashboard link, and **without a trailing slash**.
4. Run the workflow once via **Run workflow** to verify end to end.

The workflow prints the URL it calls and, on a non-2xx reply, says what the code
usually means: `401` the two `CRON_SECRET` values differ, `404`/`308` `APP_URL` is
wrong, `500` the migration has not been applied, `503` `CRON_SECRET` is missing on
the deployment.

For push, additionally set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and
`VAPID_SUBJECT` in Vercel (see `.env.example` for the offline generation command).
Changing them needs a redeploy but **not** a rebuild — the public key is read per
request and passed to the client, never inlined into the bundle.

Verifying push needs a real device; the checklist:

1. Install the PWA to the home screen — required on iOS, optional elsewhere.
2. Profilis → Pranešimai → turn **Telefone** on and accept the prompt.
3. Press **Siųsti bandomąjį** — a notification should arrive within seconds.
4. Tap it: an already-open app should come to the front rather than opening a
   second window, landing on the egg-collection form.
5. Turn the toggle off and confirm the test button no longer delivers.

Two operational notes: scheduled workflows only run on the default branch, and
GitHub disables them after 60 days of repository inactivity — re-enable from the
Actions tab. The settings screen shows _Paskutinis priminimas_, which is the
easiest way to notice that the schedule has stopped.

---

## Icons and branding

| File                                         | Used for                                                       |
| -------------------------------------------- | -------------------------------------------------------------- |
| `src/app/favicon.ico`                        | Browser tab, bookmarks — multi-size ICO (16/24/32/48/64)       |
| `src/app/icon.png`                           | Tab icon via the Next.js `icon` file convention                |
| `src/app/apple-icon.png`                     | iOS home-screen icon (180×180)                                 |
| `public/icon-192.png`, `public/icon-512.png` | Manifest icons for installed apps                              |
| `public/icon-maskable-512.png`               | Android maskable icon — the bird sits inside the 80% safe zone |
| `src/app/manifest.ts`                        | Web manifest served at `/manifest.webmanifest`                 |

To swap the artwork, replace these files at the same sizes. Next.js links them
automatically from the file names — no `<link>` tags to edit. Keep a maskable
version with padding, or Android will crop into the subject.

---

## Project structure

```
src/
  app/
    (app)/          authenticated screens, bottom tab bar + FAB layout
    (auth)/         login, register, forgot/reset password
    api/            route handlers for every mutation
    layout.tsx      root layout, metadata, viewport
    manifest.ts     web manifest
  components/
    forms/          one form component per record type
    layout/         tab bar, FAB, farm switcher, page header
    ui/             shadcn/ui primitives
  lib/
    services/       data access per module, all farm-scoped
    validation/     Zod schemas shared by forms and route handlers
    auth.ts         Auth.js with the Credentials provider (Node)
    auth.config.ts  Edge-safe config used by middleware
prisma/
  schema.prisma     data model
  migrations/       migration history
  seed.ts           demo data
docs/
  implementation-plan.md
```

**Multi-tenancy:** the active farm lives in a cookie and is resolved by
`requireActiveFarm()`; every service query is scoped by `farmId`, so no farm id
travels in the URL. The Prisma client is generated into `src/generated/prisma`
(gitignored, recreated by `npm install`).

## Branches and releases

```
feature/*  ──>  develop  ──>  main  ──>  release  ──>  production
```

- **`develop`** — where new work lands.
- **`main`** — reviewed and green; the candidate for the next release. Stays the
  default branch, because GitHub only runs scheduled workflows from it.
- **`release`** — production. Written only by the **PROD_deployment** workflow,
  which versions `main`, fast-forwards `release`, tags `vX.Y.Z`, then watches
  Vercel build and deploy it until `/api/health` confirms that exact version is
  being served.

Releases are cut by hand: **Actions → PROD_deployment → Run workflow** from
`main`, choosing `patch`, `minor` or `major`. Tick `dry_run` to see what a
release would do — including which migrations it would apply — without pushing
anything.

The running version is reported by `GET /api/health` and shown at the bottom of
the profile screen.

Full process, setup and failure handling: [`docs/RELEASE.md`](docs/RELEASE.md).

---

## Deployment (Vercel + Neon)

The app is built for **Vercel** with a **Neon** Postgres database. Vercel detects
Next.js on its own — there is no `vercel.json` and none is needed.

### One-time setup

1. **Import the repository** in Vercel (New Project → import from GitHub). Framework
   preset _Next.js_, root directory `./`, build command and output left on their
   defaults.
2. **Set the Node.js version** to 20.x or newer in _Project Settings → General_.
   Next.js 16 requires 20.9+.
3. **Add the environment variables** in _Project Settings → Environment Variables_.
   Add them to **Production**, **Preview** and **Development** — a variable that
   exists only in Production makes preview deployments fail at runtime.

   | Variable                       | Value                                                                 |
   | ------------------------------ | --------------------------------------------------------------------- |
   | `DATABASE_URL`                 | Neon connection string (see below)                                    |
   | `AUTH_SECRET`                  | `openssl rand -base64 32` — a different value per environment is fine |
   | `RESEND_API_KEY`, `EMAIL_FROM` | Only if password-reset email should really be sent                    |
   | `BLOB_READ_WRITE_TOKEN`        | Added automatically when a Vercel Blob store is linked                |

   `AUTH_URL` is not needed: Auth.js detects the deployment URL on Vercel.

4. **Connect Neon**, either through the Vercel integration or by pasting the
   connection string. Neon gives two forms of URL:
   - **pooled** (`...-pooler...`) — what the running app uses through
     `@prisma/adapter-neon`;
   - **unpooled/direct** — what `prisma migrate` needs.

   `prisma.config.ts` reads a single `DATABASE_URL`, so keep the **direct** URL in
   your local `.env` for migrations, and use the pooled URL on Vercel.

### Migrations

**Production deployments apply migrations themselves.** The `vercel-build` script
runs `prisma migrate deploy` before `next build`, but **only** when
`VERCEL_ENV=production`. If the migration fails the build stops, so a deployment
never goes live against a schema it does not have.

Preview builds deliberately skip it: previews point at whatever database
`DATABASE_URL` names, so they share production data unless you give previews their
own Neon branch — and migrating from a preview would then rewrite production.

`prisma migrate deploy` needs Neon's **unpooled** connection string. `DATABASE_URL`
is already meant to be the unpooled one (see the table above), so nothing extra is
required. If you ever switch `DATABASE_URL` to the pooled/pgbouncer URL, set
`DIRECT_URL` to the unpooled one — the build prefers it when present.

You can still apply a migration by hand, and you must do so the first time a new
table is needed before the deployment that uses it:

```bash
DATABASE_URL="<direct-neon-url>" npx prisma migrate deploy
```

### If a deployment fails

Open the failing deployment → _Building_ log, and check in this order:

- **`Environment variable not found: DATABASE_URL`** — the variable is missing for
  that environment (Preview and Production are configured separately).
- **`Cannot find module '../src/generated/prisma'`** — `postinstall` did not run.
  That happens when the install command is overridden with something that skips
  lifecycle scripts (`--ignore-scripts`); restore the default install command or add
  `prisma generate` to the build command.
- **`npm ci` errors about the lockfile** — `package-lock.json` is out of sync with
  `package.json`; run `npm install` locally and commit the lockfile.
- **Node version errors** — the project is still on Node 18; raise it to 20.x+.
- **Type or lint errors** — reproduce locally with `npm run build`; the same build
  runs on Vercel, so a clean local build means the failure is environment-specific.

Serve over HTTPS so the app stays installable as a PWA — Vercel does this by default.

## Documentation

- [`docs/RELEASE.md`](docs/RELEASE.md) — branch model, how to cut a release, and how to read a failed one
- [`docs/implementation-plan.md`](docs/implementation-plan.md) — build plan and notes on how the shipped code differs from it
- [`Paukstininkyste_reikalavimu_specifikacija.md`](Paukstininkyste_reikalavimu_specifikacija.md) — requirements specification (Lithuanian)
- [`AGENTS.md`](AGENTS.md) — notes for AI coding agents working in this repo
