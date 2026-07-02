import { requireActiveFarm } from "@/lib/session";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { EggCollectionForm } from "@/components/forms/egg-collection-form";

export default async function NewEggCollectionPage() {
  const { farm } = await requireActiveFarm();
  const groups = await listBirdGroups(farm.id);

  return (
    <div>
      <PageHeader title="Surinkti kiaušinius" backHref="/eggs/collections" />
      <div className="px-4">
        <EggCollectionForm
          birdGroups={groups.map((g) => ({ id: g.id, label: g.breed.name }))}
        />
      </div>
    </div>
  );
}
