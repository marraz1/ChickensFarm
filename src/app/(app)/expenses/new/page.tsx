import { requireActiveFarm } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { ExpenseForm, type ExpenseAreaContext } from "@/components/forms/expense-form";
import { listAreaTargetOptions } from "@/lib/services/area-targets";
import { farmAreaLabels } from "@/lib/labels";
import { AREA_EXPENSE_TARGETS, AREA_SLUGS, isAreaSlug } from "@/lib/v2-navigation";

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
    target: { ...target, options: await listAreaTargetOptions(farm.id, area, "expense") },
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
