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
// Expenses saved through the form, found by their unique description.
let savedDescriptions: string[] = [];

test.beforeEach(() => {
  expenseIds = [];
  savedDescriptions = [];
});

async function expensesByDescription(page: Page, description: string) {
  const all = (await (await page.request.get("/api/expenses")).json()) as {
    id: string;
    area: string;
    description: string | null;
  }[];
  return all.filter((e) => e.description === description);
}

test.afterEach(async ({ page }) => {
  for (const description of savedDescriptions) {
    for (const e of await expensesByDescription(page, description)) expenseIds.push(e.id);
  }
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

test("Pagal sritį splits the period's spending or income by area", async ({ page }) => {
  const date = quietDay();
  await createExpense(page, "MEAT", date, 3);
  await createExpense(page, "SHARED", date, 1);

  await page.goto(`/?period=range&from=${date}&to=${date}`);
  const card = page.getByRole("region", { name: "Pagal sritį" });
  const legendRow = (short: string) => card.getByRole("button", { name: new RegExp(`^${short}`) });

  await expect(card).toContainText("Išlaidos iš viso");
  await expect(card).toContainText("4,00");
  await expect(legendRow("Mėsa")).toContainText("75,0");
  await expect(legendRow("Bendros")).toContainText("25,0");
  await expect(legendRow("Kiaušiniai")).toContainText("0,0");
  // The text alternative names every area with its amount.
  await expect(card.getByRole("img")).toHaveAccessibleName(
    /^Išlaidos pagal sritį: Kiaušiniai .*Perekšlės .*Perinimas .*Mėsa 3,00.*Bendros 1,00/,
  );

  // The legend answers once the page has hydrated: tap until it focuses.
  await expect(async () => {
    if ((await legendRow("Mėsa").getAttribute("aria-pressed")) !== "true") {
      await legendRow("Mėsa").click();
    }
    await expect(legendRow("Mėsa")).toHaveAttribute("aria-pressed", "true", { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await expect(card).not.toContainText("Išlaidos iš viso");
  await expect(card).toContainText("3,00");

  await legendRow("Mėsa").click();
  await expect(legendRow("Mėsa")).toHaveAttribute("aria-pressed", "false");
  await expect(card).toContainText("Išlaidos iš viso");

  await card.getByRole("button", { name: "Pajamos", exact: true }).click();
  await expect(card).toContainText("Pajamos iš viso");
  await expect(card.getByRole("img")).toHaveAccessibleName(/^Pajamos pagal sritį: /);
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
  // Registered before saving, so a failure after the save still removes it.
  savedDescriptions.push(description);
  await page.goto("/expenses/new");

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

  // The form submits through its script: a click that lands before hydration
  // reloads the page empty, so fill and click again until the form answers.
  await expect(async () => {
    // A day in 2003: the exact-amount checks above use 2002.
    await page.getByLabel("Data").fill(quietDay().replace(/^2002/, "2003"));
    await page.getByLabel("Suma (€)").fill("4,50");
    await page.getByLabel("Aprašymas").fill(description);
    await page.getByRole("button", { name: "Išsaugoti" }).click();
    await expect(page.getByText("Pasirinkite sritį")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await expect(page).toHaveURL((url) => url.pathname === "/expenses/new");

  await areas.getByRole("radio", { name: "Bendra (visam ūkiui)" }).check();
  await expect(page.getByText("Išlaida bus įskaičiuota į viso ūkio finansus.")).toBeVisible();
  await page.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/expenses", { timeout: 15_000 });

  const saved = (await expensesByDescription(page, description))[0];
  expect(saved?.area).toBe("SHARED");
});
