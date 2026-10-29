import { requireActiveFarm } from "@/lib/session";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { BirdConsumptionForm } from "@/components/forms/bird-consumption-form";
import { birdGroupOptions } from "@/lib/bird-group-options";
import { groupAreaFromParam, groupAreaSlug } from "@/lib/v2-navigation";

export default async function NewBirdConsumptionPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string | string[] }>;
}) {
  // Mėsa's "Suvartoti mėsai" adds ?area=meat so only its groups are offered:
  // meat use counts in its group's area, so another area's group would not
  // show on the Mėsa overview (#190).
  const area = groupAreaFromParam((await searchParams).area);
  const { farm } = await requireActiveFarm();
  const groups = await listBirdGroups(farm.id, area);
  // Back to the list in the same area, so the bar keeps it lit after saving.
  const listPath = area ? `/birds/consumptions?area=${groupAreaSlug(area)}` : "/birds/consumptions";

  return (
    <div>
      <PageHeader title="Suvartoti paukščius mėsai" backHref={listPath} />
      <div className="px-4">
        <BirdConsumptionForm birdGroups={birdGroupOptions(groups)} onSuccessPath={listPath} />
      </div>
    </div>
  );
}
