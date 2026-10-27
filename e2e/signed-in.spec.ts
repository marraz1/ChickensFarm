import { expect, test } from "@playwright/test";

// Signed-in smoke: a seeded user can log in and reach an authenticated page.
//
// Needs E2E_USER_EMAIL / E2E_USER_PASSWORD for a user that exists in the
// database behind PLAYWRIGHT_BASE_URL. CI passes them only for PRs into the V2
// line, whose previews run on their own Neon branch (docs/v2-environment.md).
// V1 previews share the production database, where no test user may exist, so
// without the variables the suite skips instead of failing.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.skip(!email || !password, "E2E_USER_EMAIL / E2E_USER_PASSWORD not set");

test("a seeded user signs in and sees their profile", async ({ page }) => {
  await page.goto("/login?callbackUrl=%2Fprofile");
  await page.getByLabel("El. paštas").fill(email!);
  await page.getByLabel("Slaptažodis").fill(password!);
  await page.getByRole("button", { name: "Prisijungti" }).click();

  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "Profilis" })).toBeVisible();
  await expect(page.getByText(email!)).toBeVisible();
});
