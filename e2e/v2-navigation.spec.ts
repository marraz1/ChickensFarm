import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE } from "./auth-file";

// V2 area navigation (#185). Needs the seeded user, like signed-in.spec.ts;
// skipped without it.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD; // read by auth.setup.ts; checked here to skip

test.skip(!email || !password, "E2E_USER_EMAIL / E2E_USER_PASSWORD not set");
// Signed in once by e2e/auth.setup.ts; logins are rate-limited.
test.use({ storageState: AUTH_FILE });

const areaBar = (page: Page) => page.getByRole("navigation", { name: "Ūkio sritys" });

test("the bottom bar lists the farm areas and has no add button", async ({ page }) => {
  await page.goto("/");

  await expect(areaBar(page).getByRole("link")).toHaveText([
    "Apžvalga",
    "Kiaušiniai",
    "Perekšlės",
    "Perinimas",
    "Mėsa",
  ]);
  await expect(areaBar(page).getByRole("link", { name: "Apžvalga" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("button", { name: "Pridėti įrašą" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Profilis" })).toBeVisible();
});

test("an area shows its four tabs and keeps the bar item active", async ({ page }) => {
  await page.goto("/");

  await areaBar(page).getByRole("link", { name: "Kiaušiniai" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Kiaušiniai ir prekyba" }),
  ).toBeVisible();

  const tabs = page.getByRole("navigation", { name: "Srities skirtukai" });
  await expect(tabs.getByRole("link")).toHaveText([
    "Apžvalga",
    "Išlaidos",
    "Nuostoliai",
    "Finansai",
  ]);

  await tabs.getByRole("link", { name: "Išlaidos" }).click();
  await expect(page).toHaveURL(/\/areas\/eggs\/expenses$/);
  await expect(tabs.getByRole("link", { name: "Išlaidos" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(areaBar(page).getByRole("link", { name: "Kiaušiniai" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("a reused V1 screen sits under its area", async ({ page }) => {
  await page.goto("/");

  await page.goto("/eggs/collections");
  await expect(areaBar(page).getByRole("link", { name: "Kiaušiniai" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("bar items, area tabs and the profile button are at least 44px tall on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.goto("/areas/eggs");

  // locator.all() does not wait: it returns whatever is rendered at that
  // instant. Wait for every bar item and tab first, or a page still settling
  // under load yields fewer than 10 targets.
  const barLinks = areaBar(page).getByRole("link");
  const tabLinks = page.getByRole("navigation", { name: "Srities skirtukai" }).getByRole("link");
  await expect(barLinks).toHaveCount(5);
  await expect(tabLinks).toHaveCount(4);

  const targets = [
    ...(await barLinks.all()),
    ...(await tabLinks.all()),
    page.getByRole("button", { name: "Profilis" }),
  ];
  expect(targets).toHaveLength(10);
  for (const target of targets) {
    // Measure only once laid out: under load the page can still be settling,
    // and boundingBox() of an element not yet rendered is null (read as 0).
    await expect(target).toBeVisible();
    const box = await target.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("an unknown area is a 404", async ({ page }) => {
  await page.goto("/");

  const response = await page.goto("/areas/unknown");
  expect(response?.status()).toBe(404);
});
