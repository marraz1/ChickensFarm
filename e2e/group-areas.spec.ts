import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE } from "./auth-file";

// Bird groups belong to Kiaušiniai or Mėsa (#186). Needs the seeded user, like
// signed-in.spec.ts; skipped without it. Groups are created through the API
// (the breed select is not what this story changes) and deleted again after
// each test, so the shared preview farm does not grow run by run.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD; // read by auth.setup.ts; checked here to skip

test.skip(!email || !password, "E2E_USER_EMAIL / E2E_USER_PASSWORD not set");
// Signed in once by e2e/auth.setup.ts; logins are rate-limited.
test.use({ storageState: AUTH_FILE });

type Created = { breedId?: string; groupIds: string[] };
let created: Created = { groupIds: [] };

test.beforeEach(() => {
  created = { groupIds: [] };
});

test.afterEach(async ({ page }) => {
  // Groups first: a breed with groups cannot be deleted.
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

  const make = async (name: string, area: "EGGS" | "MEAT") => {
    const res = await page.request.post("/api/bird-groups", {
      data: {
        breedId: created.breedId,
        name,
        sex: "UNKNOWN",
        category: area === "MEAT" ? "COCKEREL" : "LAYER",
        quantity: 3,
        birthOrAcquiredDate: "2026-01-01",
        area,
      },
    });
    expect(res.ok()).toBe(true);
    const id = (await res.json()).id as string;
    created.groupIds.push(id);
    return id;
  };
  const names = { eggs: `Dedeklės ${tag}`, meat: `Mėsiniai ${tag}` };
  const ids = { eggs: await make(names.eggs, "EGGS"), meat: await make(names.meat, "MEAT") };
  return { names, ids };
}

const areaBar = (page: Page) => page.getByRole("navigation", { name: "Ūkio sritys" });
const expectActive = (page: Page, label: string) =>
  expect(areaBar(page).getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");

test("each area lists only its own groups", async ({ page }) => {
  await page.goto("/");
  const { names } = await createGroups(page);

  await page.goto("/bird-groups?area=meat");
  await expect(page.getByRole("heading", { name: "Mėsinių grupės" })).toBeVisible();
  await expect(page.getByText(names.meat)).toBeVisible();
  await expect(page.getByText(names.eggs)).toHaveCount(0);
  await expectActive(page, "Mėsa");

  await page.goto("/bird-groups?area=eggs");
  await expect(page.getByRole("heading", { name: "Dedeklių grupės" })).toBeVisible();
  await expect(page.getByText(names.eggs)).toBeVisible();
  await expect(page.getByText(names.meat)).toHaveCount(0);
  await expectActive(page, "Kiaušiniai");
});

test("a group's page keeps its own area lit, however it was opened", async ({ page }) => {
  await page.goto("/");
  const { names, ids } = await createGroups(page);

  // From the unfiltered list…
  await page.goto("/bird-groups");
  await page.getByText(names.meat).click();
  // A client navigation to a page that may still be compiling (dev server) or
  // waking a cold deployment: allow well past the 5s default.
  await expect(page).toHaveURL(new RegExp(`/bird-groups/${ids.meat}\\?area=meat$`), {
    timeout: 15_000,
  });
  await expectActive(page, "Mėsa");

  // …and from a bare link (a save redirect, an old bookmark).
  await page.goto(`/bird-groups/${ids.meat}`);
  await expect(page).toHaveURL(new RegExp(`/bird-groups/${ids.meat}\\?area=meat$`));
  await expectActive(page, "Mėsa");
});

test("the group form preselects the area it was opened from", async ({ page }) => {
  await page.goto("/");
  await createGroups(page); // makes sure the farm has a breed, so the form renders

  await page.goto("/bird-groups/new?area=meat");
  await expect(page.getByRole("radio", { name: "Mėsiniai paukščiai" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Kiaušiniai ir prekyba" })).not.toBeChecked();
  // Perinimas is never offered for a new group.
  await expect(page.getByRole("radio", { name: "Perinimas" })).toHaveCount(0);

  await page.goto("/bird-groups/new?area=eggs");
  await expect(page.getByRole("radio", { name: "Kiaušiniai ir prekyba" })).toBeChecked();
});

test("a group cannot be saved without an area", async ({ page }) => {
  await page.goto("/");
  await createGroups(page);

  await page.goto("/bird-groups/new");
  await expect(page.getByRole("radio", { name: "Kiaušiniai ir prekyba" })).not.toBeChecked();
  await expect(page.getByRole("radio", { name: "Mėsiniai paukščiai" })).not.toBeChecked();
  await page.getByRole("button", { name: "Sukurti grupę" }).click();
  await expect(page.getByText("Pasirinkite sritį")).toBeVisible();
  await expect(page).toHaveURL(/\/bird-groups\/new$/);
});

test("buying chicks for meat offers only Mėsa groups", async ({ page }) => {
  await page.goto("/");
  const { names } = await createGroups(page);

  await page.goto("/birds/purchases/new?area=meat");
  await expectActive(page, "Mėsa");
  await page.getByLabel("Paukščių grupė (neprivaloma)").click();
  await expect(page.getByRole("option", { name: new RegExp(names.meat) })).toBeVisible();
  await expect(page.getByRole("option", { name: new RegExp(names.eggs) })).toHaveCount(0);
});
