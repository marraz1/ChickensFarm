import { requireActiveFarm } from "@/lib/session";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { IncubationCycleForm } from "@/components/forms/incubation-cycle-form";

export default async function NewIncubationCyclePage() {
  const { farm } = await requireActiveFarm();
  const groups = await listBirdGroups(farm.id);

  return (
    <div>
      <PageHeader title="Naujas perinimo ciklas" backHref="/incubation" />
      <div className="px-4">
        <IncubationCycleForm birdGroups={groups.map((g) => ({ id: g.id, label: g.breed.name }))} />
      </div>
    </div>
  );
}
