import { requireActiveFarm } from "@/lib/session";
import { listBreeds } from "@/lib/services/breeds";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { BirdGroupForm } from "@/components/forms/bird-group-form";

export default async function NewBirdGroupPage() {
  const { farm } = await requireActiveFarm();
  const [breeds, groups] = await Promise.all([listBreeds(farm.id), listBirdGroups(farm.id)]);

  return (
    <div>
      <PageHeader title="Nauja paukščių grupė" backHref="/bird-groups" />
      <div className="px-4">
        <BirdGroupForm
          breeds={breeds}
          existingGroups={groups.map((g) => ({ id: g.id, breedId: g.breedId, sex: g.sex, category: g.category }))}
          onSuccessPath="/bird-groups"
        />
      </div>
    </div>
  );
}
