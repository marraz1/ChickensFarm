import { requireActiveFarm } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { ExpenseForm, type ExpenseAreaContext } from "@/components/forms/expense-form";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { listMotherHens } from "@/lib/services/mother-hens";
import { listIncubationCycles } from "@/lib/services/incubation";
import { birdGroupOptions } from "@/lib/bird-group-options";
import { farmAreaLabels } from "@/lib/labels";
import { formatDateLT } from "@/lib/format";
import { AREA_EXPENSE_TARGETS, AREA_SLUGS, isAreaSlug, type AreaSlug } from "@/lib/v2-navigation";

// The active farm's targets an expense in this area may point at — never
// another area's (the server enforces the same rule, #179).
async function targetOptions(farmId: string, slug: AreaSlug) {
  switch (slug) {
    case "eggs":
      return birdGroupOptions(await listBirdGroups(farmId, "EGGS"));
    case "meat":
      return birdGroupOptions(await listBirdGroups(farmId, "MEAT"));
    case "hens":
      return (await listMotherHens(farmId))
        .filter((hen) => hen.diedAt === null)
        .map((hen) => ({ id: hen.id, label: hen.name }));
    case "incubation":
      return (await listIncubationCycles(farmId)).map((cycle) => ({
        id: cycle.id,
        label: cycle.name || `Ciklas nuo ${formatDateLT(cycle.startDate)}`,
      }));
  }
}

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string | string[] }>;
}) {
  const { area } = await searchParams;
  const { farm } = await requireActiveFarm();

  // "Išlaida" on an area's Išlaidos tab opens this with ?area=<slug> (#192).
  // Without one it stays the general form ("Keisti" leads here).
  if (typeof area !== "string" || !isAreaSlug(area)) {
    return (
      <div>
        <PageHeader title="Nauja išlaida" backHref="/expenses" />
        <div className="px-4">
          <ExpenseForm />
        </div>
      </div>
    );
  }

  const tabPath = `/areas/${area}/expenses`;
  const target = AREA_EXPENSE_TARGETS[area];
  const areaContext: ExpenseAreaContext = {
    area: AREA_SLUGS[area],
    areaLabel: farmAreaLabels[AREA_SLUGS[area]],
    changeHref: "/expenses/new",
    target: { ...target, options: await targetOptions(farm.id, area) },
  };

  return (
    <div>
      <PageHeader title="Nauja išlaida" backHref={tabPath} />
      <div className="px-4">
        <ExpenseForm areaContext={areaContext} onSuccessPath={tabPath} />
      </div>
    </div>
  );
}
