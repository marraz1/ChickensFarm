import { expect, test, type Page } from "@playwright/test";

// V2 area navigation (#185). Needs the seeded user, like signed-in.spec.ts;
// skipped without it.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.skip(!email || !password, "E2E_USER_EMAIL / E2E_USER_PASSWORD not set");

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("El. paštas").fill(email!);
  await page.getByLabel("Slaptažodis").fill(password!);
  await page.getByRole("button", { name: "Prisijungti" }).click();
  // First sign-in on a cold deployment can take well past the 5s default.
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
}

const areaBar = (page: Page) => page.getByRole("navigation", { name: "Ūkio sritys" });

test("the bottom bar lists the farm areas and has no add button", async ({ page }) => {
  await signIn(page);

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
  await signIn(page);

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
  await signIn(page);

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
  await signIn(page);
  await page.goto("/areas/eggs");

  const targets = [
    ...(await areaBar(page).getByRole("link").all()),
    ...(await page.getByRole("navigation", { name: "Srities skirtukai" }).getByRole("link").all()),
    page.getByRole("button", { name: "Profilis" }),
  ];
  expect(targets).toHaveLength(10);
  for (const target of targets) {
    const box = await target.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("an unknown area is a 404", async ({ page }) => {
  await signIn(page);

  const response = await page.goto("/areas/unknown");
  expect(response?.status()).toBe(404);
});
