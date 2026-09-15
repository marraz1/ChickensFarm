// Client-side instrumentation (issue #74). See
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md —
// this file runs after the HTML document loads but before React hydration.
//
// NEXT_PUBLIC_SENTRY_DSN is optional. It is unset in local development and
// in CI, and `enabled: false` in that case turns the SDK into a full no-op
// rather than erroring or silently dropping events against an invalid DSN.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),

  // Vercel exposes VERCEL_ENV to the client bundle under this NEXT_PUBLIC_
  // alias (system env vars aren't otherwise available in browser code);
  // NODE_ENV covers everything else (local dev, tests). Mirrors
  // sentry.server.config.ts / sentry.edge.config.ts.
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,

  // Kept low on purpose: the free tier's event quota is the limiting
  // resource for a small solo-maintained project, not trace coverage gaps.
  tracesSampleRate: dsn ? 0.1 : 0,

  // See src/sentry.server.config.ts for why this is on for all three levels.
  integrations: [Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] })],
});

// Required by the SDK to record App Router navigations as breadcrumbs/spans;
// see the "ACTION REQUIRED" warning in @sentry/nextjs's withSentryConfig.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
