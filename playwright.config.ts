import { defineConfig, devices } from "@playwright/test";

// Point PLAYWRIGHT_BASE_URL at a deployed build (the Vercel preview in CI) to
// test it as-is. Without it, the suite starts a local dev server.
const remoteBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const isCI = Boolean(process.env.CI);

// Vercel Deployment Protection puts preview URLs behind a login. When the
// project's "Protection Bypass for Automation" secret is supplied, send it on
// every request (and ask Vercel to set a cookie so browser navigations keep it).
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: remoteBaseURL ?? "http://localhost:3000",
    trace: "on-first-retry",
    extraHTTPHeaders: bypassSecret
      ? {
          "x-vercel-protection-bypass": bypassSecret,
          "x-vercel-set-bypass-cookie": "true",
        }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: remoteBaseURL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: !isCI,
        timeout: 120_000,
        env: {
          // Enough for the auth middleware to run; the smoke tests touch no database.
          AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-only-secret",
        },
      },
});
