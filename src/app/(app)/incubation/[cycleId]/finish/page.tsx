import { notFound, redirect } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getIncubationCycle } from "@/lib/services/incubation";
import { listBirdGroups } from "@/lib/services/bird-groups";
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
  if (cycle.growthCompletedAt || !cycle.resultingGroup) redirect(`/incubation/${cycleId}`);

  const groups = await listBirdGroups(farm.id);
  // Any group except the cohort itself is a valid transfer target.
  const targets = groups
    .filter((g) => g.id !== cycle.resultingGroupId)
    .map((g) => ({
      id: g.id,
      label: `${g.breed.name} · ${birdCategoryLabels[g.category]} (${g.quantity})`,
    }));

  return (
    <div>
      <PageHeader title="Užbaigti sekimą" backHref={`/incubation/${cycleId}`} />
      <div className="px-4">
        <p className="mb-4 text-sm text-muted-foreground">
          Jauniklių grupėje šiuo metu {cycle.resultingGroup.quantity} paukščių. Pasirinkite, ką daryti
          užbaigus auginimą.
        </p>
        <FinishGrowthForm
          cycleId={cycleId}
          cohortQuantity={cycle.resultingGroup.quantity}
          groups={targets}
        />
      </div>
    </div>
  );
}
