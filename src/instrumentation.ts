// Next.js server instrumentation entry point (issue #74). See
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md —
// `register()` runs once per server instance before it accepts requests,
// and `onRequestError` is invoked by Next.js itself for errors thrown
// during rendering (Server Components, Server Actions, route handlers)
// that don't already flow through `handleApiError` in src/lib/api-utils.ts.
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Routed through the same structured-logging + Sentry-reporting path as
// every other unexpected error (see `logError` in src/lib/errors.ts) rather
// than a second, disconnected capture call — this is the only place an
// error reaches Sentry without first passing through `handleApiError`.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { logError } = await import("@/lib/errors");
  logError(`onRequestError.${context.routerKind}.${context.routeType}`, err, "unexpected");
};
