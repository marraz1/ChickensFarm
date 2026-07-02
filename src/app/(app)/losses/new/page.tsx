import { requireActiveFarm } from "@/lib/session";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { LossForm } from "@/components/forms/loss-form";

export default async function NewLossPage() {
  const { farm } = await requireActiveFarm();
  const groups = await listBirdGroups(farm.id);

  return (
    <div>
      <PageHeader title="Registruoti nuostolį" backHref="/losses" />
      <div className="px-4">
        <LossForm birdGroups={groups.map((g) => ({ id: g.id, label: g.breed.name }))} />
      </div>
    </div>
  );
}
