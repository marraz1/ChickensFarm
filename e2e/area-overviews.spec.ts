import { expect as baseExpect, test, type Page } from "@playwright/test";
import { AUTH_FILE } from "./auth-file";

// The V2 area overviews (#187–#190): stat cards, the year's balance, the
// records list and the "Naujas įrašas" sheet. Needs the seeded user; skipped
// without it. The preview farm is shared, so figures are checked by shape.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD; // read by auth.setup.ts; checked here to skip

test.skip(!email || !password, "E2E_USER_EMAIL / E2E_USER_PASSWORD not set");
// Signed in once by e2e/auth.setup.ts; logins are rate-limited.
test.use({ storageState: AUTH_FILE });
// An overview compiles on first visit under a cold dev server and reads many
// figures; the default 5 s assertions failed in full parallel runs.
test.describe.configure({ timeout: 60_000 });
const expect = baseExpect.configure({ timeout: 15_000 });
const slow = { timeout: 15_000 };

const farmYear = () =>
  new Intl.DateTimeFormat("en", { timeZone: "Europe/Vilnius", year: "numeric" }).format(new Date());

const sheet = (page: Page) => page.getByRole("dialog", { name: "Naujas įrašas" });
const areaBarLink = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Ūkio sritys" }).getByRole("link", { name });

/**
 * Opens the "Naujas įrašas" sheet. The button is server-rendered, so a click
 * that lands before the page hydrates does nothing; retry until it opens.
 */
async function openSheet(page: Page, button: string) {
  await expect(async () => {
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(sheet(page)).toBeVisible({ timeout: 2_000 });
  }).toPass(slow);
}

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
    await openSheet(page, "Naujas");

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

    await openSheet(page, "Naujas");
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
    // Other hens may sit on the shared preview farm, so only "at least one" is
    // certain here; the exact "8 kiaušiniai · 1-a diena" line is unit-tested
    // (sittingDetail), and her card above already says "Peri".
    await expect(page.getByRole("region", { name: "Peri dabar" })).toContainText(
      /^Peri dabar[1-9]/,
    );
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/mother-hens/${henId}$`), { timeout: 15_000 });
  });

  test("Nauja opens the sheet with the hen actions", async ({ page }) => {
    await page.goto("/areas/hens");
    await openSheet(page, "Nauja");

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

test.describe("Perinimas (#189)", () => {
  let cycleId: string | undefined;

  const farmToday = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vilnius" }).format(new Date());

  test.afterEach(async ({ page }) => {
    // A cycle has no delete endpoint: hatch it with no chicks, so it never
    // counts as active again on the shared preview farm.
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
    cycleId = undefined;
  });

  test("shows running cycles, efficiency, the balance and a card per cycle", async ({ page }) => {
    const name = `E2E ciklas ${Date.now()}`;
    const cycle = await page.request.post("/api/incubation-cycles", {
      data: { name, startDate: farmToday(), eggsTotal: 12 },
    });
    expect(cycle.ok()).toBe(true);
    cycleId = (await cycle.json()).id as string;

    await page.goto("/areas/incubation");
    await expect(page.getByRole("region", { name: "Aktyvūs ciklai" })).toContainText(
      /^Aktyvūs ciklai[1-9]/,
    );
    await expect(page.getByRole("region", { name: "Efektyvumas" })).toBeVisible();
    await expect(page.getByRole("region", { name: `Balansas · ${farmYear()} m.` })).toBeVisible();

    const card = page.getByRole("link").filter({ hasText: name });
    await expect(card).toContainText("Pradėta");
    await expect(card).toContainText("1-a diena");
    await expect(card).toContainText("12 kiaušinių");
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/incubation/${cycleId}$`), { timeout: 15_000 });
  });

  test("Naujas ciklas opens the sheet, which leads to the new-cycle form", async ({ page }) => {
    await page.goto("/areas/incubation");
    await openSheet(page, "Naujas ciklas");

    await expect(sheet(page)).toContainText("Perinimas");
    await expect(sheet(page).getByRole("link")).toHaveText([
      "Naujas perinimo ciklas",
      "Apšvietimas / patikra",
      "Registruoti išsiritimą",
      "Jauniklių sekimo įrašas",
      "Nauja išlaida",
      "Registruoti nuostolį",
    ]);
    await sheet(page).getByRole("link", { name: "Naujas perinimo ciklas" }).click();
    await expect(page).toHaveURL(/\/incubation\/new$/, { timeout: 15_000 });
  });
});

test.describe("Mėsa (#190)", () => {
  test("shows the birds raised, meat use, the balance, the records and the latest use", async ({
    page,
  }) => {
    await page.goto("/areas/meat");

    await expect(page.getByRole("heading", { level: 1, name: "Mėsiniai paukščiai" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Auginama mėsai" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Suvartota mėsai" })).toContainText(
      /Šį mėn\. \d+ · Metais \d+/,
    );
    await expect(page.getByRole("region", { name: `Balansas · ${farmYear()} m.` })).toBeVisible();

    await expect(page.getByRole("link", { name: /^Mėsinių grupės\s*\d+/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Suvartota mėsai\s*\d+/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Mėsinių pardavimai\s*.+€/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Paskutiniai įrašai" })).toBeVisible();
  });

  test("Naujas opens the sheet, which leads to the meat-use form", async ({ page }) => {
    await page.goto("/areas/meat");
    await openSheet(page, "Naujas");

    await expect(sheet(page)).toContainText("Mėsiniai paukščiai");
    await expect(sheet(page).getByRole("link")).toHaveText([
      "Suvartoti mėsai",
      "Parduoti paukščių",
      "Pirkti jauniklių auginti",
      "Nauja mėsinių grupė",
      "Nauja išlaida",
      "Registruoti nuostolį",
    ]);
    await sheet(page).getByRole("link", { name: "Suvartoti mėsai" }).click();
    await expect(page).toHaveURL(/\/birds\/consumptions\/new\?area=meat$/, { timeout: 15_000 });
    await expect(areaBarLink(page, "Mėsa")).toHaveAttribute("aria-current", "page");
  });

  test("the meat-use and sales records open lists kept to Mėsa", async ({ page }) => {
    await page.goto("/areas/meat");
    await page.getByRole("link", { name: /^Suvartota mėsai\s*\d+/ }).click();
    await expect(page).toHaveURL(/\/birds\/consumptions\?area=meat$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Mėsai suvartoti paukščiai" })).toBeVisible();
    await expect(areaBarLink(page, "Mėsa")).toHaveAttribute("aria-current", "page");

    await page.goto("/areas/meat");
    await page.getByRole("link", { name: /^Mėsinių pardavimai/ }).click();
    await expect(page).toHaveURL(/\/birds\/sales\?area=meat$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Mėsinių pardavimai" })).toBeVisible();
    await expect(areaBarLink(page, "Mėsa")).toHaveAttribute("aria-current", "page");
  });
});
