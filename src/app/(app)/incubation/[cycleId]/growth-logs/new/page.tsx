import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getIncubationCycle } from "@/lib/services/incubation";
import { PageHeader } from "@/components/layout/page-header";
import { GrowthLogForm } from "@/components/forms/growth-log-form";

export default async function NewGrowthLogPage({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const { cycleId } = await params;
  const { farm } = await requireActiveFarm();
  const cycle = await getIncubationCycle(farm.id, cycleId);
  if (!cycle) notFound();

  return (
    <div>
      <PageHeader title="Jauniklių sekimas" backHref={`/incubation/${cycleId}`} />
      <div className="px-4">
        <GrowthLogForm cycleId={cycleId} />
      </div>
    </div>
  );
}
