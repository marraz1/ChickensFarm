import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE } from "./auth-file";

// Recording a loss against what was lost (#195). Needs the seeded user;
// skipped without it. Creates its own breed, groups, hen and losses and
// deletes them again (losses first: they block deleting a hen and restore
// what they changed). Incubation cycles have no delete endpoint, so cycle
// losses are covered by the service tests instead.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD; // read by auth.setup.ts; checked here to skip

test.skip(!email || !password, "E2E_USER_EMAIL / E2E_USER_PASSWORD not set");
// Signed in once by e2e/auth.setup.ts; logins are rate-limited.
test.use({ storageState: AUTH_FILE });

type Created = { breedId?: string; groupIds: string[]; henIds: string[]; tag: string };
let created: Created = { groupIds: [], henIds: [], tag: "" };

test.beforeEach(() => {
  created = { groupIds: [], henIds: [], tag: `${Date.now()}-${Math.floor(Math.random() * 1000)}` };
});

test.afterEach(async ({ page }) => {
  const losses = (await (await page.request.get("/api/losses")).json()) as {
    id: string;
    comment: string | null;
  }[];
  for (const l of losses.filter((l) => l.comment?.includes(created.tag))) {
    await page.request.delete(`/api/losses/${l.id}`);
  }
  for (const id of created.henIds) await page.request.delete(`/api/mother-hens/${id}`);
  for (const id of created.groupIds) await page.request.delete(`/api/bird-groups/${id}`);
  if (created.breedId) await page.request.delete(`/api/breeds/${created.breedId}`);
});

async function createGroup(page: Page, area: "EGGS" | "MEAT", quantity: number) {
  if (!created.breedId) {
    const breed = await page.request.post("/api/breeds", {
      data: { name: `E2E veislė ${created.tag}`, birdType: "HEN" },
    });
    expect(breed.ok()).toBe(true);
    created.breedId = (await breed.json()).id as string;
  }
  const name = `${area === "EGGS" ? "Dedeklės" : "Mėsiniai"} ${created.tag}`;
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
  return { id, name };
}

async function groupQuantity(page: Page, id: string) {
  const groups = (await (await page.request.get("/api/bird-groups")).json()) as {
    id: string;
    quantity: number;
  }[];
  return groups.find((g) => g.id === id)?.quantity;
}

const areaBar = (page: Page) => page.getByRole("navigation", { name: "Ūkio sritys" });

test("Nuostolis on an area's Nuostoliai tab opens the area loss form", async ({ page }) => {
  await page.goto("/areas/eggs/losses");
  await page.getByRole("link", { name: "Nuostolis", exact: true }).click();

  await expect(page).toHaveURL(/\/losses\/new\?area=eggs$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Naujas nuostolis" })).toBeVisible();
  await expect(page.getByText("Sritis", { exact: true })).toBeVisible();
  await expect(page.getByText("Kiaušiniai ir prekyba")).toBeVisible();
  await expect(page.getByText("Dedeklių grupė", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Grupės kiekis bus sumažintas ir įrašytas į istoriją."),
  ).toBeVisible();
  await expect(page.getByLabel("Kiekis")).toHaveValue("1");
  await expect(page.getByRole("button", { name: "Liga" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Plėšrūnas" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: "Kita" })).toBeVisible();
  await expect(areaBar(page).getByRole("link", { name: "Kiaušiniai" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("each area names what is lost and what happens to it", async ({ page }) => {
  for (const [area, label, hint, quantityLabel] of [
    ["meat", "Mėsinių grupė", "Grupės kiekis bus sumažintas ir įrašytas į istoriją.", "Kiekis"],
    ["hens", "Perekšlė", "Perekšlė bus pažymėta kaip nugaišusi.", "Kiekis"],
    ["incubation", "Perinimo ciklas", "Gyvų jauniklių skaičius cikle bus sumažintas.", "Jauniklių"],
  ] as const) {
    await page.goto(`/losses/new?area=${area}`);
    await expect(page.getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByText(hint)).toBeVisible();
    await expect(page.getByText(quantityLabel, { exact: true })).toBeVisible();
  }
});

test("a loss needs a target and at least one bird", async ({ page }) => {
  await page.goto("/losses/new?area=eggs");
  await page.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Pasirinkite dedeklių grupę")).toBeVisible();

  await page.getByLabel("Kiekis").fill("0");
  await page.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page.getByText("Kiekis turi būti bent 1")).toBeVisible();
  await expect(page).toHaveURL(/\/losses\/new\?area=eggs$/);
});

test("a group loss lowers the group and returns to the area", async ({ page }) => {
  const group = await createGroup(page, "EGGS", 3);
  const meat = await createGroup(page, "MEAT", 5);
  await page.goto("/losses/new?area=eggs");

  await page.getByLabel("Dedeklių grupė").click();
  // Only this area's groups are offered.
  await expect(page.getByRole("option", { name: new RegExp(meat.name) })).toHaveCount(0);
  await page.getByRole("option", { name: new RegExp(group.name) }).click();
  await page.getByLabel("Kiekis").fill("2");
  await page.getByRole("button", { name: "Plėšrūnas" }).click();
  await page.getByLabel("Komentaras").fill(`lapė ${created.tag}`);
  await page.getByRole("button", { name: "Išsaugoti" }).click();

  await expect(page).toHaveURL(/\/areas\/eggs\/losses$/, { timeout: 15_000 });
  expect(await groupQuantity(page, group.id)).toBe(1);
  expect(await groupQuantity(page, meat.id)).toBe(5);
});

test("a mother hen's loss marks her dead", async ({ page }) => {
  const henName = `E2E perekšlė ${created.tag}`;
  const hen = await page.request.post("/api/mother-hens", { data: { name: henName } });
  expect(hen.ok()).toBe(true);
  const henId = (await hen.json()).id as string;
  created.henIds.push(henId);

  await page.goto("/losses/new?area=hens");
  await expect(page.getByLabel("Kiekis")).toHaveAttribute("readonly", "");
  await page.getByLabel("Perekšlė").click();
  await page.getByRole("option", { name: henName }).click();
  await page.getByLabel("Komentaras").fill(`liga ${created.tag}`);
  await page.getByRole("button", { name: "Išsaugoti" }).click();
  await expect(page).toHaveURL(/\/areas\/hens\/losses$/, { timeout: 15_000 });

  const hens = (await (await page.request.get("/api/mother-hens")).json()) as {
    id: string;
    diedAt: string | null;
  }[];
  expect(hens.find((h) => h.id === henId)?.diedAt).toBeTruthy();

  // A dead hen is no longer offered.
  await page.goto("/losses/new?area=hens");
  await page.getByLabel("Perekšlė").click();
  await expect(page.getByRole("option", { name: henName })).toHaveCount(0);
});
