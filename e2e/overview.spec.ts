import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE } from "./auth-file";

// The farm overview's result (#201). Needs the seeded user; skipped without
// it. The preview farm is shared, so exact amounts are checked over a one-day
// "Laikotarpis" in 2002 that only this spec writes to; the year and
// month views are checked by shape only. Expenses it creates are deleted again.
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
  // A failed delete would leave money on the shared preview farm.
  for (const id of expenseIds) {
    expect((await page.request.delete(`/api/expenses/${id}`)).ok()).toBe(true);
  }
});

async function createExpense(page: Page, area: string, expenseDate: string, amount: number) {
  const res = await page.request.post("/api/expenses", {
    data: { area, expenseDate, category: "OTHER", amount, description: "E2E apžvalga" },
  });
  expect(res.ok()).toBe(true);
  expenseIds.push((await res.json()).id as string);
}

const farmYear = () =>
  new Intl.DateTimeFormat("en", { timeZone: "Europe/Vilnius", year: "numeric" }).format(new Date());

// A random day in 2002 (area-finance.spec.ts uses 2001), so parallel runs rarely share one.
function quietDay() {
  const month = 1 + Math.floor(Math.random() * 12);
  const dayOfMonth = 1 + Math.floor(Math.random() * 28);
  return `2002-${String(month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
}

const periodNav = (page: Page) => page.getByRole("navigation", { name: "Ataskaitos laikotarpis" });

test("the overview shows the farm result for this year, switchable to this month", async ({
  page,
}) => {
  const year = farmYear();
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Ūkio apžvalga" })).toBeVisible();
  await expect(periodNav(page).getByRole("link")).toHaveText([
    "Šis mėn.",
    `${year} m.`,
    "Laikotarpis",
  ]);
  await expect(periodNav(page).getByRole("link", { name: `${year} m.` })).toHaveAttribute(
    "aria-current",
    "true",
  );
  const result = page.getByRole("region", {
    name: new RegExp(`^(Pelnas|Nuostolis) · ${year} m\\.$`),
  });
  await expect(result).toBeVisible();
  await expect(result.getByRole("region", { name: "Pajamos", exact: true })).toBeVisible();
  await expect(result.getByRole("region", { name: "Išlaidos", exact: true })).toBeVisible();

  await periodNav(page).getByRole("link", { name: "Šis mėn." }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/" && url.search === "?period=month", {
    timeout: 15_000,
  });
  await expect(
    page.getByRole("region", { name: new RegExp(`^(Pelnas|Nuostolis) · \\S+ ${year}$`) }),
  ).toBeVisible();
});

test("the farm result adds the areas and Bendros išlaidos", async ({ page }) => {
  const date = quietDay();
  await createExpense(page, "MEAT", date, 3);
  await createExpense(page, "SHARED", date, 2);

  await page.goto(`/?period=range&from=${date}&to=${date}`);
  const result = page.getByRole("region", { name: `Nuostolis · ${date} – ${date}` });
  // lt-LT formats a negative amount with a true minus sign (U+2212).
  await expect(result).toContainText("−5,00");
  await expect(result.getByRole("region", { name: "Pajamos", exact: true })).toContainText("0,00");
  await expect(result.getByRole("region", { name: "Išlaidos", exact: true })).toContainText("5,00");
});

test("Išlaida opens the general expense form", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Išlaida", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/expenses/new" && url.search === "", {
    timeout: 15_000,
  });
  await expect(page.getByRole("heading", { name: "Nauja išlaida" })).toBeVisible();
});

test("the general expense form asks for the area and files a shared cost under Bendra", async ({
  page,
}) => {
  const description = `E2E bendra ${Date.now()}`;
  await page.goto("/expenses/new");
  // The form submits through its script; a click before hydration would not.
  await page.waitForLoadState("networkidle");

  const areas = page.getByRole("group", { name: "Sritis" });
  await expect(areas.getByRole("radio")).toHaveCount(5);
  for (const name of [
    "Kiaušiniai ir prekyba",
    "Perekšlės",
    "Perinimas",
    "Mėsiniai paukščiai",
    "Bendra (visam ūkiui)",
  ]) {
    await expect(areas.getByRole("radio", { name })).not.toBeChecked();
  }

  await page.getByLabel("Data").fill(quietDay());
  await page.getByLabel("Suma (€)").fill("4,50");
  await page.getByLabel("Aprašymas").fill(description);
  await page.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Pasirinkite sritį")).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === "/expenses/new");

  await areas.getByRole("radio", { name: "Bendra (visam ūkiui)" }).check();
  await page.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/expenses", { timeout: 15_000 });

  const all = (await (await page.request.get("/api/expenses")).json()) as {
    id: string;
    area: string;
    description: string | null;
  }[];
  const saved = all.find((e) => e.description === description);
  expect(saved?.area).toBe("SHARED");
  if (saved) expenseIds.push(saved.id);
});
