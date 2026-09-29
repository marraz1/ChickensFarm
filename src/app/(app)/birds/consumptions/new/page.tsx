import { requireActiveFarm } from "@/lib/session";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { BirdConsumptionForm } from "@/components/forms/bird-consumption-form";
import { birdGroupOptions } from "@/lib/bird-group-options";

export default async function NewBirdConsumptionPage() {
  const { farm } = await requireActiveFarm();
  const groups = await listBirdGroups(farm.id);

  return (
    <div>
      <PageHeader title="Suvartoti paukščius mėsai" backHref="/birds/consumptions" />
      <div className="px-4">
        <BirdConsumptionForm birdGroups={birdGroupOptions(groups)} />
      </div>
    </div>
  );
}
