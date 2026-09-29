import { expect, test } from "@playwright/test";

// Smoke level: the deployment serves pages, and the auth middleware is wired up.
// Nothing here needs a database or a seeded user, so it is safe to run against
// any preview build.

test("login page renders the sign-in form", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByLabel("El. paštas")).toBeVisible();
  await expect(page.getByLabel("Slaptažodis")).toBeVisible();
  await expect(page.getByRole("button", { name: "Prisijungti" })).toBeVisible();
});

test("signed-out visitors are redirected from the dashboard to login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login\?callbackUrl=%2F$/);
  await expect(page.getByRole("button", { name: "Prisijungti" })).toBeVisible();
});

test("privacy notice is reachable without signing in", async ({ page }) => {
  await page.goto("/privacy");

  await expect(page.getByRole("heading", { level: 1, name: "Privatumo pranešimas" })).toBeVisible();
});
