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
