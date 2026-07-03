import { notFound, redirect } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getIncubationCycle } from "@/lib/services/incubation";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { listBreeds } from "@/lib/services/breeds";
import { PageHeader } from "@/components/layout/page-header";
import { FinishGrowthForm } from "@/components/forms/finish-growth-form";
import { birdCategoryLabels } from "@/lib/labels";

export default async function FinishGrowthPage({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const { cycleId } = await params;
  const { farm } = await requireActiveFarm();
  const cycle = await getIncubationCycle(farm.id, cycleId);
  if (!cycle) notFound();

  const cohort = cycle.resultingGroup;
  const available = cohort ? cohort.quantity : cycle.hatchedCount ?? 0;
  // Only reachable once hatched and while there are birds to distribute.
  if (cycle.growthCompletedAt || !cycle.hatchDate || available <= 0) {
    redirect(`/incubation/${cycleId}`);
  }

  const [groups, breeds] = await Promise.all([listBirdGroups(farm.id), listBreeds(farm.id)]);

  // Any group except the cohort itself is a valid transfer target.
  const targets = groups
    .filter((g) => g.id !== cycle.resultingGroupId)
    .map((g) => ({
      id: g.id,
      label: `${g.breed.name} · ${birdCategoryLabels[g.category]} (${g.quantity})`,
    }));

  const defaultBreedId = cohort?.breedId ?? cycle.eggSourceGroup?.breedId ?? breeds[0]?.id ?? "";

  return (
    <div>
      <PageHeader title="Užbaigti sekimą" backHref={`/incubation/${cycleId}`} />
      <div className="px-4">
        <FinishGrowthForm
          cycleId={cycleId}
          available={available}
          groups={targets}
          breeds={breeds.map((b) => ({ id: b.id, label: b.name }))}
          defaultBreedId={defaultBreedId}
        />
      </div>
    </div>
  );
}
