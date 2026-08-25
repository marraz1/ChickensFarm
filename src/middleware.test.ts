import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The matcher must stay a literal inside `config` for Next to extract it at
 * build time, so it cannot be imported from a shared module. Reading the source
 * is the only way to test the real pattern rather than a copy that can drift.
 */
function matcherRegex(): RegExp {
  const source = readFileSync("src/middleware.ts", "utf8");
  const match = source.match(/matcher:\s*\[\s*"((?:[^"\\]|\\.)*)"/);
  if (!match) throw new Error("matcher literal not found in src/middleware.ts");
  // The file is TypeScript source, so `\\.` in the literal is an escaped
  // backslash; unescape it back to the regex the runtime actually compiles.
  return new RegExp(`^${match[1].replace(/\\\\/g, "\\")}$`);
}

/** Middleware runs on a path only when the matcher matches it. */
const isProtected = (path: string) => matcherRegex().test(path);

describe("middleware matcher", () => {
  it("protects application pages and data APIs", () => {
    for (const path of [
      "/",
      "/profile",
      "/profile/notifications",
      "/eggs/collections/new",
      "/api/egg-collections",
      "/api/notifications/test",
    ]) {
      expect(isProtected(path), path).toBe(true);
    }
  });

  it("lets self-authenticating and pre-session routes through", () => {
    // Each of these authenticates itself, or is fetched before a session can
    // exist. A redirect to /login would hand back HTML: to curl that reads as a
    // success, and to the browser it breaks manifest and worker registration.
    for (const path of [
      "/api/auth/session",
      "/api/cron/reminders",
      "/api/health",
      "/sw.js",
      "/icon-192.png",
      "/manifest.webmanifest",
    ]) {
      expect(isProtected(path), path).toBe(false);
    }
  });

  it("does not open lookalike paths that merely share a prefix", () => {
    // api/auth and api/cron are prefixes, because they have sub-routes.
    // api/health is anchored, so a future /api/healthcheck-anything cannot
    // slip out from behind auth by sharing its first ten characters.
    for (const path of ["/swagger.js", "/some/sw.js", "/api/healthcheck-page"]) {
      expect(isProtected(path), path).toBe(true);
    }
  });
});
