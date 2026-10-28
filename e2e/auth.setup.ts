import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test as setup } from "@playwright/test";
import { AUTH_FILE } from "./auth-file";

// Signs the seeded e2e user in ONCE and saves the session for the specs that
// need a signed-in user but do not test sign-in itself (`test.use({
// storageState: AUTH_FILE })`). The app rate-limits logins (8 per 10 min per
// email, src/lib/rate-limit.ts), so signing in inside every test trips it as
// soon as the suite grows (#186).
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

setup("sign in the e2e user", async ({ page }) => {
  mkdirSync(dirname(AUTH_FILE), { recursive: true });
  if (!email || !password) {
    // Dependent specs skip themselves without credentials; they still need a
    // readable (empty) state file to start.
    writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }
  await page.goto("/login");
  await page.getByLabel("El. paštas").fill(email);
  await page.getByLabel("Slaptažodis").fill(password);
  await page.getByRole("button", { name: "Prisijungti" }).click();
  // First sign-in on a cold deployment can take well past the 5s default.
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await page.context().storageState({ path: AUTH_FILE });
});
