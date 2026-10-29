import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE } from "./auth-file";

// The V2 area overviews (#187–#190): stat cards, the year's balance, the
// records list and the "Naujas įrašas" sheet. Needs the seeded user; skipped
// without it. The preview farm is shared, so figures are checked by shape.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD; // read by auth.setup.ts; checked here to skip

test.skip(!email || !password, "E2E_USER_EMAIL / E2E_USER_PASSWORD not set");
// Signed in once by e2e/auth.setup.ts; logins are rate-limited.
test.use({ storageState: AUTH_FILE });

const farmYear = () =>
  new Intl.DateTimeFormat("en", { timeZone: "Europe/Vilnius", year: "numeric" }).format(new Date());

const sheet = (page: Page) => page.getByRole("dialog", { name: "Naujas įrašas" });

test.describe("Kiaušiniai (#187)", () => {
  test("shows egg stock, the laying flock, the balance and the records", async ({ page }) => {
    const year = farmYear();
    await page.goto("/areas/eggs");

    const stock = page.getByRole("region", { name: "Kiaušinių likutis" });
    await expect(stock).toContainText(/Šį mėn\. \d+ · Metais [\d\s ]+/);
    await expect(page.getByRole("region", { name: "Dedeklių pulkas" })).toBeVisible();
    const balance = page.getByRole("region", { name: `Balansas · ${year} m.` });
    await expect(balance).toContainText(/Pajamos .+ · Išlaidos .+/);

    for (const label of [
      "Kiaušinių surinkimas",
      "Kiaušinių pardavimai",
      "Suvartoti kiaušiniai",
      "Paukščių pirkimai",
      "Paukščių pardavimai",
      "Dedeklių grupės",
    ]) {
      await expect(page.getByRole("link", { name: new RegExp(`^${label}`) })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /^Kiaušinių surinkimas/ })).toContainText(
      /\d+ šį mėn\./,
    );

    await balance.click();
    await expect(page).toHaveURL(/\/areas\/eggs\/finance$/, { timeout: 15_000 });
  });

  test("Naujas opens the new-record sheet, which closes and leads to the forms", async ({
    page,
  }) => {
    await page.goto("/areas/eggs");
    await page.getByRole("button", { name: "Naujas" }).click();

    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page)).toContainText("Kiaušiniai ir prekyba");
    await expect(sheet(page).getByRole("link")).toHaveText([
      "Surinkti kiaušinius",
      "Parduoti kiaušinius",
      "Suvartoti kiaušinius",
      "Pirkti paukščių",
      "Parduoti paukščių",
      "Nauja dedeklių grupė",
      "Nauja išlaida",
      "Registruoti nuostolį",
    ]);

    await sheet(page).getByRole("button", { name: "Uždaryti" }).click();
    await expect(sheet(page)).toBeHidden();

    await page.getByRole("button", { name: "Naujas" }).click();
    await sheet(page).getByRole("link", { name: "Surinkti kiaušinius" }).click();
    await expect(page).toHaveURL(/\/eggs\/collections\/new$/, { timeout: 15_000 });
  });
});

test.describe("Perekšlės (#188)", () => {
  let henId: string | undefined;
  let cycleId: string | undefined;

  test.afterEach(async ({ page }) => {
    // A cycle has no delete endpoint: hatch it with no chicks, so it never
    // counts as active again on the shared preview farm, then remove the hen
    // (the cycle keeps no link to her: SetNull).
    if (cycleId) {
      const hatched = await page.request.patch(`/api/incubation-cycles/${cycleId}`, {
        data: {
          action: "hatch",
          hatchDate: farmToday(),
          hatchedCount: 0,
          target: { mode: "none" },
        },
      });
      expect(hatched.ok()).toBe(true);
    }
    if (henId) expect((await page.request.delete(`/api/mother-hens/${henId}`)).ok()).toBe(true);
    henId = cycleId = undefined;
  });

  const farmToday = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vilnius" }).format(new Date());

  test("shows the hens, who is sitting, the balance and a card per hen", async ({ page }) => {
    const name = `E2E perekšlė ${Date.now()}`;
    const hen = await page.request.post("/api/mother-hens", { data: { name } });
    expect(hen.ok()).toBe(true);
    henId = (await hen.json()).id as string;

    await page.goto("/areas/hens");
    await expect(page.getByRole("region", { name: "Perekšlės" })).toContainText(name);
    await expect(page.getByRole("region", { name: "Peri dabar" })).toBeVisible();
    await expect(page.getByRole("region", { name: `Balansas · ${farmYear()} m.` })).toBeVisible();
    const card = page.getByRole("link").filter({ hasText: name });
    await expect(card).toContainText("Ilsisi · 0 įrašų");

    // The cycle form offers her, then a brood under her makes her sit.
    await page.goto(`/incubation/new?motherHenId=${henId}`);
    await expect(page.getByLabel("Perekšlė (neprivaloma)")).toContainText(name);

    const cycle = await page.request.post("/api/incubation-cycles", {
      data: { name: `E2E ${name}`, startDate: farmToday(), eggsTotal: 8, motherHenId: henId },
    });
    expect(cycle.ok()).toBe(true);
    cycleId = (await cycle.json()).id as string;

    await page.goto("/areas/hens");
    await expect(card).toContainText("Peri · 0 įrašų");
    await expect(page.getByRole("region", { name: "Peri dabar" })).toContainText(
      new RegExp(`${name}|8 kiaušiniai · 1-a diena`),
    );
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/mother-hens/${henId}$`), { timeout: 15_000 });
  });

  test("Nauja opens the sheet with the hen actions", async ({ page }) => {
    await page.goto("/areas/hens");
    await page.getByRole("button", { name: "Nauja" }).click();

    await expect(sheet(page)).toContainText("Perekšlės");
    await expect(sheet(page).getByRole("link")).toHaveText([
      "Nauja perekšlė",
      "Dienoraščio įrašas",
      "Pradėti perėjimą su perekšle",
      "Nauja išlaida",
      "Registruoti nuostolį",
    ]);
    await sheet(page).getByRole("button", { name: "Uždaryti" }).click();
    await expect(sheet(page)).toBeHidden();
  });
});
