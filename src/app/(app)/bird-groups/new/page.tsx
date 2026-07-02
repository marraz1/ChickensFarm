import { requireActiveFarm } from "@/lib/session";
import { listBreeds } from "@/lib/services/breeds";
import { PageHeader } from "@/components/layout/page-header";
import { BirdGroupForm } from "@/components/forms/bird-group-form";

export default async function NewBirdGroupPage() {
  const { farm } = await requireActiveFarm();
  const breeds = await listBreeds(farm.id);

  return (
    <div>
      <PageHeader title="Nauja paukščių grupė" backHref="/bird-groups" />
      <div className="px-4">
        <BirdGroupForm breeds={breeds} />
      </div>
    </div>
  );
}
