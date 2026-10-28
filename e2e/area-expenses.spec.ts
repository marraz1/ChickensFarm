import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE } from "./auth-file";

// Recording an expense for an area (#192). Needs the seeded user; skipped
// without it. Creates its own breed, groups and expense and deletes them again.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD; // read by auth.setup.ts; checked here to skip

test.skip(!email || !password, "E2E_USER_EMAIL / E2E_USER_PASSWORD not set");
// Signed in once by e2e/auth.setup.ts; logins are rate-limited.
test.use({ storageState: AUTH_FILE });

type Created = {
  breedId?: string;
  groupIds: string[];
  expenseIds: string[];
  henIds: string[];
  purchaseIds: string[];
};
const none = (): Created => ({ groupIds: [], expenseIds: [], henIds: [], purchaseIds: [] });
let created: Created = none();

test.beforeEach(() => {
  created = none();
});

test.afterEach(async ({ page }) => {
  for (const id of created.purchaseIds) await page.request.delete(`/api/bird-transactions/${id}`);
  for (const id of created.expenseIds) await page.request.delete(`/api/expenses/${id}`);
  for (const id of created.henIds) await page.request.delete(`/api/mother-hens/${id}`);
  for (const id of created.groupIds) await page.request.delete(`/api/bird-groups/${id}`);
  if (created.breedId) await page.request.delete(`/api/breeds/${created.breedId}`);
});

async function createGroups(page: Page) {
  const tag = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const breed = await page.request.post("/api/breeds", {
    data: { name: `E2E veislė ${tag}`, birdType: "HEN" },
  });
  expect(breed.ok()).toBe(true);
  created.breedId = (await breed.json()).id as string;

  const make = async (name: string, area: "EGGS" | "MEAT", quantity = 3) => {
    const res = await page.request.post("/api/bird-groups", {
      data: {
        breedId: created.breedId,
        name,
        sex: "UNKNOWN",
        category: area === "MEAT" ? "COCKEREL" : "LAYER",
        quantity,
        birthOrAcquiredDate: "2026-01-01",
        area,
      },
    });
    expect(res.ok()).toBe(true);
    const id = (await res.json()).id as string;
    created.groupIds.push(id);
    return id;
  };
  const names = {
    eggs: `Dedeklės ${tag}`,
    meat: `Mėsiniai ${tag}`,
    emptyEggs: `Tuščia ${tag}`,
  };
  const ids = { eggs: await make(names.eggs, "EGGS"), meat: await make(names.meat, "MEAT") };
  await make(names.emptyEggs, "EGGS", 0); // sold out: not a current target
  return { names, ids };
}

const areaBar = (page: Page) => page.getByRole("navigation", { name: "Ūkio sritys" });
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test("Išlaida on an area's Išlaidos tab opens the area expense form", async ({ page }) => {
  await page.goto("/areas/eggs/expenses");
  await page.getByRole("link", { name: "Išlaida", exact: true }).click();

  await expect(page).toHaveURL(/\/expenses\/new\?area=eggs$/);
  await expect(page.getByRole("heading", { name: "Nauja išlaida" })).toBeVisible();
  await expect(page.getByText("Sritis", { exact: true })).toBeVisible();
  await expect(page.getByText("Kiaušiniai ir prekyba")).toBeVisible();
  await expect(
    page.getByText("Išlaida bus įskaičiuota į šios srities ir viso ūkio finansus."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Keisti" })).toHaveAttribute("href", "/expenses/new");
  await expect(page.getByLabel("Data")).toHaveValue(todayLocal());
  await expect(page.getByLabel("Suma (€)")).toHaveAttribute("placeholder", "pvz. 12,50");
  await expect(areaBar(page).getByRole("link", { name: "Kiaušiniai" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

// The target field only shows when the area has something to pick, so this
// creates a group per area and a mother hen. Incubation cycles have no delete
// endpoint, so "Perinimo ciklas (neprivaloma)" is pinned by the
// AREA_EXPENSE_TARGETS unit test instead of leaving test cycles behind.
test("each area labels its target", async ({ page }) => {
  await createGroups(page);
  const hen = await page.request.post("/api/mother-hens", {
    data: { name: `E2E perekšlė ${Date.now()}` },
  });
  expect(hen.ok()).toBe(true);
  created.henIds.push((await hen.json()).id as string);

  for (const [area, label] of [
    ["eggs", "Dedeklių grupė (neprivaloma)"],
    ["hens", "Perekšlė (neprivaloma)"],
    ["meat", "Mėsinių grupė (neprivaloma)"],
  ] as const) {
    await page.goto(`/expenses/new?area=${area}`);
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
});

test("saving without an amount shows a Lithuanian message", async ({ page }) => {
  await page.goto("/expenses/new?area=meat");
  await page.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Įveskite sumą")).toBeVisible();
  await expect(page).toHaveURL(/\/expenses\/new\?area=meat$/);
});

test("an Eggs expense on an Eggs group is saved and returns to the area", async ({ page }) => {
  const { names, ids } = await createGroups(page);
  await page.goto("/expenses/new?area=eggs");

  // Only this area's current groups are offered: not Mėsa's, not a sold-out one.
  await page.getByLabel("Dedeklių grupė (neprivaloma)").click();
  await expect(page.getByRole("option", { name: new RegExp(names.meat) })).toHaveCount(0);
  await expect(page.getByRole("option", { name: new RegExp(names.emptyEggs) })).toHaveCount(0);
  await page.getByRole("option", { name: new RegExp(names.eggs) }).click();

  const description = `E2E išlaida ${Date.now()}`;
  await page.getByLabel("Suma (€)").fill("12,50");
  await page.getByLabel("Aprašymas").fill(description);
  await page.getByRole("button", { name: "Išsaugoti" }).click();

  await expect(page).toHaveURL(/\/areas\/eggs\/expenses$/);

  const expenses = (await (await page.request.get("/api/expenses")).json()) as {
    id: string;
    description: string | null;
    area: string;
    amount: string | number;
    birdGroupId: string | null;
  }[];
  const saved = expenses.find((e) => e.description === description);
  expect(saved).toBeDefined();
  created.expenseIds.push(saved!.id);
  expect(saved).toMatchObject({ area: "EGGS", birdGroupId: ids.eggs });
  expect(Number(saved!.amount)).toBe(12.5);
});

// #194: an area's Išlaidos tab.
test("the Išlaidos tab lists the area's expenses and Kiaušiniai's bird purchases", async ({
  page,
}) => {
  const { names, ids } = await createGroups(page);
  const today = todayLocal();
  const description = `E2E sąrašas ${Date.now()}`;

  const exp = await page.request.post("/api/expenses", {
    data: {
      expenseDate: today,
      category: "FEED",
      amount: 12.5,
      area: "EGGS",
      birdGroupId: ids.eggs,
      description,
    },
  });
  expect(exp.ok()).toBe(true);
  created.expenseIds.push((await exp.json()).id as string);

  const buy = await page.request.post("/api/bird-transactions", {
    data: { type: "PURCHASE", transactionDate: today, quantity: 4, unitPrice: 8.5 },
  });
  expect(buy.ok()).toBe(true);
  const purchaseId = (await buy.json()).id as string;
  created.purchaseIds.push(purchaseId);

  await page.goto("/areas/eggs/expenses");
  const card = page.getByLabel(`Išlaidos · ${new Date().getFullYear()} m.`);
  await expect(card).toBeVisible();
  await expect(card.getByText("Pašarai", { exact: true })).toBeVisible();
  await expect(card.getByText("Paukščių pirkimai", { exact: true })).toBeVisible();

  const row = page.getByRole("link").filter({ hasText: description });
  await expect(row).toHaveAttribute("href", /\/expenses\/.+\/edit\?area=eggs$/);
  await expect(row).toContainText("Pašarai ·");
  await expect(row).toContainText(names.eggs);
  await expect(row).toContainText(/12,50\s€/);

  const purchaseRow = page.locator(`a[href^="/birds/purchases/${purchaseId}/edit"]`);
  await expect(purchaseRow).toContainText("Paukščių pirkimas ·");
  await expect(purchaseRow).toContainText("4 vnt. · iš pirkimų");
  await expect(purchaseRow).toContainText(/34,00\s€/);

  // Opened from the area, the expense returns to the area and keeps it lit.
  await row.click();
  await expect(page).toHaveURL(/\/expenses\/.+\/edit\?area=eggs$/, { timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Grįžti" })).toHaveAttribute(
    "href",
    "/areas/eggs/expenses",
  );
  await expect(
    page.getByRole("navigation", { name: "Ūkio sritys" }).getByRole("link", { name: "Kiaušiniai" }),
  ).toHaveAttribute("aria-current", "page");

  // Bird purchases count in Kiaušiniai only (#194 decision).
  await page.goto("/areas/meat/expenses");
  await expect(page.locator(`a[href^="/birds/purchases/${purchaseId}/edit"]`)).toHaveCount(0);
});

test("an area with no expenses says so", async ({ page }) => {
  const all = (await (await page.request.get("/api/expenses")).json()) as { area: string }[];
  test.skip(
    all.some((e) => e.area === "HENS"),
    "the e2e farm has Perekšlės expenses",
  );

  await page.goto("/areas/hens/expenses");
  await expect(page.getByText("Šioje srityje dar nėra išlaidų.")).toBeVisible();
  // The way to add one is still there.
  await expect(page.getByRole("link", { name: "Išlaida", exact: true })).toBeVisible();
});
