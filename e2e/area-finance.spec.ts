import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE } from "./auth-file";

// An area's Finansai tab (#198). Needs the seeded user; skipped without it.
// The preview farm is shared, so exact amounts are checked over a one-day
// "Laikotarpis" in 2001 that only this spec writes to; the year and month
// views are checked by shape only. Expenses it creates are deleted again.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD; // read by auth.setup.ts; checked here to skip

test.skip(!email || !password, "E2E_USER_EMAIL / E2E_USER_PASSWORD not set");
// Signed in once by e2e/auth.setup.ts; logins are rate-limited.
test.use({ storageState: AUTH_FILE });

let expenseIds: string[] = [];

test.beforeEach(() => {
  expenseIds = [];
});

test.afterEach(async ({ page }) => {
  for (const id of expenseIds) await page.request.delete(`/api/expenses/${id}`);
});

async function createExpense(
  page: Page,
  data: { area: string; expenseDate: string; category: string; amount: number },
) {
  const res = await page.request.post("/api/expenses", {
    data: { ...data, description: "E2E finansai" },
  });
  expect(res.ok()).toBe(true);
  expenseIds.push((await res.json()).id as string);
}

const farmYear = () =>
  new Intl.DateTimeFormat("en", { timeZone: "Europe/Vilnius", year: "numeric" }).format(new Date());

// A random day in 2001, so parallel runs rarely share one.
function quietDay() {
  const month = 1 + Math.floor(Math.random() * 12);
  const dayOfMonth = 1 + Math.floor(Math.random() * 28);
  return `2001-${String(month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
}

const periodNav = (page: Page) => page.getByRole("navigation", { name: "Ataskaitos laikotarpis" });

test("Finansai shows the year's result with the period switch", async ({ page }) => {
  const year = farmYear();
  await page.goto("/areas/meat/finance");

  await expect(periodNav(page).getByRole("link")).toHaveText([
    "Šis mėn.",
    `${year} m.`,
    "Laikotarpis",
  ]);
  await expect(periodNav(page).getByRole("link", { name: `${year} m.` })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(
    page.getByRole("region", { name: new RegExp(`^(Pelnas|Nuostolis) · ${year} m\\.$`) }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Pajamos" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Išlaidos" })).toBeVisible();
  // The placeholder is gone.
  await expect(page.getByText("Ši skiltis dar kuriama V2 beta versijoje.")).toHaveCount(0);

  await periodNav(page).getByRole("link", { name: "Šis mėn." }).click();
  await expect(page).toHaveURL(/\/areas\/meat\/finance\?period=month$/, { timeout: 15_000 });
  await expect(
    page.getByRole("region", { name: new RegExp(`^(Pelnas|Nuostolis) · \\S+ ${year}$`) }),
  ).toBeVisible();
});

test("an area's expenses over a chosen period give its loss, by category", async ({ page }) => {
  const date = quietDay();
  await createExpense(page, { area: "MEAT", expenseDate: date, category: "MEDICINE", amount: 9 });
  await createExpense(page, { area: "MEAT", expenseDate: date, category: "FEED", amount: 3 });
  // Another area's expense on the same day stays out of Mėsa.
  await createExpense(page, { area: "INC", expenseDate: date, category: "OTHER", amount: 50 });

  await page.goto("/areas/meat/finance");
  await periodNav(page).getByRole("link", { name: "Laikotarpis" }).click();
  await page.getByLabel("Nuo").fill(date);
  await page.getByLabel("Iki").fill(date);
  await page.getByRole("button", { name: "Rodyti" }).click();
  await expect(page).toHaveURL(new RegExp(`period=range&from=${date}&to=${date}$`), {
    timeout: 15_000,
  });

  const result = page.getByRole("region", { name: `Nuostolis · ${date} – ${date}` });
  await expect(result).toContainText("-12,00");
  await expect(page.getByRole("region", { name: "Pajamos" })).toContainText("Pardavimų nebuvo");
  await expect(page.getByRole("region", { name: "Išlaidos" })).toContainText("Vaistai, pašarai");

  const categories = page.getByRole("region", { name: "Išlaidos pagal kategoriją" });
  await expect(categories.getByRole("listitem")).toHaveCount(2);
  await expect(categories.getByRole("listitem").first()).toContainText("Vaistai");
  await expect(categories.getByRole("listitem").first()).toContainText("75,0");
  await expect(categories.getByRole("listitem").last()).toContainText("25,0");

  const months = page.getByRole("region", { name: "Pagal mėnesius" });
  await expect(months.getByRole("listitem")).toHaveCount(1);
  await expect(months).toContainText("Išlaidos 12,00");
});

test("Perekšlės notes where hatched chicks count, and the farm link goes to the overview", async ({
  page,
}) => {
  await page.goto("/areas/hens/finance");
  await expect(page.getByText("Išperinti jaunikliai įskaitomi Perinimo srityje")).toBeVisible();

  await page.getByRole("link", { name: "Visi ūkio finansai" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/", { timeout: 15_000 });
});
