import { requireActiveFarm } from "@/lib/session";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { MotherHenForm } from "@/components/forms/mother-hen-form";

export default async function NewMotherHenPage() {
  const { farm } = await requireActiveFarm();
  const groups = await listBirdGroups(farm.id);

  return (
    <div>
      <PageHeader title="Nauja perekšlė" backHref="/mother-hens" />
      <div className="px-4">
        <MotherHenForm birdGroups={groups.map((g) => ({ id: g.id, label: g.breed.name }))} />
      </div>
    </div>
  );
}
