# Monitoring

## Error tracking (Sentry)

**Source:** GitHub issue #74, from the ATP Risk Report's Reliability finding
"No Production Error Monitoring" — before this, production errors were only
discovered via user reports or release-time smoke tests (`stack.md` recorded
"Error tracking: Not detected").

### What's wired up

`@sentry/nextjs` (`^10.74.0`) is installed and fully configured in code. It
integrates with the existing structured-error-logging path from issue #91
(`src/lib/errors.ts`, `src/lib/api-utils.ts`) rather than adding a second,
disconnected capture path:

- **`src/sentry.server.config.ts`** / **`src/sentry.edge.config.ts`** —
  `Sentry.init()` for the Node.js and Edge runtimes respectively. Both read
  the DSN from `SENTRY_DSN`. When it's unset, `enabled: false` makes the SDK
  a complete no-op (no network calls, nothing captured) — this is the state
  in local dev and CI today.
- **`src/instrumentation.ts`** — the Next.js server instrumentation entry
  point ([file convention
  docs](../node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md)).
  `register()` loads the right config above based on `NEXT_RUNTIME`.
  `onRequestError` (Next's hook for errors thrown during rendering — Server
  Components, Server Actions, and anything not already caught by an API
  route's own try/catch) forwards into `logError()` from `src/lib/errors.ts`,
  the same function every API route already uses.
- **`src/instrumentation-client.ts`** — client-side counterpart ([file
  convention
  docs](../node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md)).
  Reads `NEXT_PUBLIC_SENTRY_DSN`, same no-op-when-unset behavior, and exports
  `onRouterTransitionStart` so Sentry gets App Router navigation breadcrumbs.
- **`src/lib/errors.ts`** — `logError()` now calls `Sentry.captureException`
  for `severity: "unexpected"` errors only (in addition to its existing
  `console.error` JSON line). `"expected"` errors (`ValidationError`,
  `ForbiddenError`, `ConcurrentModificationError` — already mapped to a 4xx
  response by `handleApiError`) are deliberately **not** sent to Sentry: they
  aren't on-call-worthy, and sending them would burn the free tier's event
  quota on noise. Since every API route already calls `handleApiError` ->
  `logError`, every unhandled server error in the app is now reported to
  Sentry automatically, with no per-route changes needed.
- **`next.config.ts`** — wrapped with `withSentryConfig` (imported from
  `@sentry/nextjs/config`, per that version's deprecation notice) for source
  map upload. `sourcemaps.disable` is `!process.env.SENTRY_AUTH_TOKEN`, so
  **the build never requires Sentry credentials to succeed** — without
  `SENTRY_AUTH_TOKEN` (local dev, CI, or a Vercel deployment before the owner
  configures it) the plugin does no network I/O and the build behaves exactly
  as it did before Sentry was added. This was verified by running a full
  `npm run build` with no Sentry env vars set.
- **`.env.example`** — documents `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`,
  `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, all marked optional.

### Acceptance criteria status

- [x] `@sentry/nextjs` installed and configured — done in this PR.
- [x] CI / tests still pass — lint, typecheck, `vitest run` (145 tests),
      `npm run build` (no Sentry credentials), and `npm audit` were all run
      locally against this change with no new failures or advisories.
- [ ] **A test error is captured and visible in Sentry — not done, and not
      possible from this PR.** This repo has no Sentry account or DSN
      available to the environment this change was made in. The SDK is
      wired up so that once a real DSN is supplied, error capture works
      immediately with no further code changes — but confirming an event
      actually lands in a Sentry project requires a Sentry account, which
      only the repo owner can create.

### Manual steps for the repo owner (to close out the remaining criterion)

1. **Create a Sentry account and project** at <https://sentry.io> (the free
   Developer tier covers a project this size). Choose "Next.js" as the
   platform when prompted — this only affects Sentry's onboarding copy, not
   the code, since the SDK is already installed and configured.
2. **Get the DSN**: in the new project, go to Settings -> Client Keys (DSN)
   and copy the DSN value.
3. **Add environment variables in Vercel** (Project Settings -> Environment
   Variables), for Production (and Preview, if you want preview deployments
   monitored too):
   - `SENTRY_DSN` — the DSN from step 2.
   - `NEXT_PUBLIC_SENTRY_DSN` — the same DSN value (it's intentionally
     exposed to the client bundle; that's normal for a Sentry DSN, it's not
     a secret).
   - Optional, for readable stack traces instead of minified ones:
     `SENTRY_AUTH_TOKEN` (Settings -> Auth Tokens in Sentry, needs the
     `project:releases` scope), `SENTRY_ORG`, `SENTRY_PROJECT` (both visible
     in the project's Sentry URL).
4. **Redeploy** so the new environment variables take effect.
5. **Trigger a test error** and confirm it shows up in the Sentry dashboard.
   The simplest way: temporarily add a route that throws (e.g. hit an
   existing API route with intentionally malformed input to trigger an
   `unexpected`-severity error through `handleApiError`), or add a
   throwaway page that calls `throw new Error("Sentry test")` in a Server
   Component. Check the project's Issues stream in Sentry a few seconds
   later. Once confirmed, remove any throwaway test code.
6. Optionally configure Sentry's email alert rules (Settings -> Alerts) —
   the default "a new issue is created" rule already covers the "email
   alerts" part of the original ask, but is worth reviewing for noise
   tolerance.
