// Sentry configuration for the Node.js server runtime (issue #74).
//
// Imported once from `register()` in `src/instrumentation.ts` when
// `NEXT_RUNTIME === "nodejs"` — never imported directly by application code.
//
// SENTRY_DSN is optional. It is unset in local development and in CI, and
// `enabled: false` in that case turns the SDK into a full no-op (no network
// calls, no captured events) rather than erroring or silently dropping
// events against an invalid DSN.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),

  // Vercel sets VERCEL_ENV to "production" | "preview" | "development" on
  // deployments; NODE_ENV covers everything else (local dev, tests).
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  // Kept low on purpose: the free tier's event quota is the limiting
  // resource for a small solo-maintained project, not trace coverage gaps.
  tracesSampleRate: dsn ? 0.1 : 0,
});
