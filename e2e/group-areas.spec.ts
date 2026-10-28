import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE } from "./auth-file";

// Bird groups belong to Kiaušiniai or Mėsa (#186). Needs the seeded user, like
// signed-in.spec.ts; skipped without it. Groups are created through the API
// (the breed select is not what this story changes), the area screens through
// the UI.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD; // read by auth.setup.ts; checked here to skip

test.skip(!email || !password, "E2E_USER_EMAIL / E2E_USER_PASSWORD not set");
// Signed in once by e2e/auth.setup.ts; logins are rate-limited.
test.use({ storageState: AUTH_FILE });

async function createGroups(page: Page) {
  const tag = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const breed = await page.request.post("/api/breeds", {
    data: { name: `E2E veislė ${tag}`, birdType: "HEN" },
  });
  expect(breed.ok()).toBe(true);
  const breedId = (await breed.json()).id as string;

  const make = async (name: string, area: "EGGS" | "MEAT") => {
    const res = await page.request.post("/api/bird-groups", {
      data: {
        breedId,
        name,
        sex: "UNKNOWN",
        category: area === "MEAT" ? "COCKEREL" : "LAYER",
        quantity: 3,
        birthOrAcquiredDate: "2026-01-01",
        area,
      },
    });
    expect(res.ok()).toBe(true);
  };
  const names = { eggs: `Dedeklės ${tag}`, meat: `Mėsiniai ${tag}` };
  await make(names.eggs, "EGGS");
  await make(names.meat, "MEAT");
  return names;
}

const areaBar = (page: Page) => page.getByRole("navigation", { name: "Ūkio sritys" });

test("each area lists only its own groups", async ({ page }) => {
  await page.goto("/");
  const names = await createGroups(page);

  await page.goto("/bird-groups?area=meat");
  await expect(page.getByRole("heading", { name: "Mėsinių grupės" })).toBeVisible();
  await expect(page.getByText(names.meat)).toBeVisible();
  await expect(page.getByText(names.eggs)).toHaveCount(0);
  await expect(areaBar(page).getByRole("link", { name: "Mėsa" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.goto("/bird-groups?area=eggs");
  await expect(page.getByRole("heading", { name: "Dedeklių grupės" })).toBeVisible();
  await expect(page.getByText(names.eggs)).toBeVisible();
  await expect(page.getByText(names.meat)).toHaveCount(0);
  await expect(areaBar(page).getByRole("link", { name: "Kiaušiniai" })).toHaveAttribute(
    "aria-current",
    "page",
  );
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
  const names = await createGroups(page);

  await page.goto("/birds/purchases/new?area=meat");
  await expect(areaBar(page).getByRole("link", { name: "Mėsa" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByLabel("Paukščių grupė (neprivaloma)").click();
  await expect(page.getByRole("option", { name: new RegExp(names.meat) })).toBeVisible();
  await expect(page.getByRole("option", { name: new RegExp(names.eggs) })).toHaveCount(0);
});
