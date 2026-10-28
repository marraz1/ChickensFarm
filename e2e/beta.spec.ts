import { expect, test, type Page } from "@playwright/test";

// V2 beta banner and version (#181). Only where a beta deployment is under
// test: CI sets E2E_EXPECT_BETA for PRs into the V2 line, like the e2e user.
const expectBeta = process.env.E2E_EXPECT_BETA === "1";
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.skip(!expectBeta, "E2E_EXPECT_BETA not set: not a V2 beta deployment");

const banner = (page: Page) =>
  page.getByRole("note").filter({ hasText: "Beta: duomenys gali būti perrašyti" });

test("the beta banner shows before signing in", async ({ page }) => {
  await page.goto("/login");
  await expect(banner(page)).toBeVisible();
});

test("the beta banner and version show after signing in", async ({ page }) => {
  test.skip(!email || !password, "E2E_USER_EMAIL / E2E_USER_PASSWORD not set");

  await page.goto("/login?callbackUrl=%2Fareas%2Feggs");
  await page.getByLabel("El. paštas").fill(email!);
  await page.getByLabel("Slaptažodis").fill(password!);
  await page.getByRole("button", { name: "Prisijungti" }).click();
  // First sign-in on a cold deployment can take well past the 5s default.
  await expect(page).toHaveURL(/\/areas\/eggs$/, { timeout: 30_000 });
  await expect(banner(page)).toBeVisible();

  await page.goto("/profile");
  await expect(banner(page)).toBeVisible();
  await expect(page.getByText(/Versija .+ · V2 beta/)).toBeVisible();
});
