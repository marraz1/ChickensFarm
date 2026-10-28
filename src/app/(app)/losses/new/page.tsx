import { requireActiveFarm } from "@/lib/session";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { listAreaTargetOptions } from "@/lib/services/area-targets";
import { PageHeader } from "@/components/layout/page-header";
import { LossForm, type LossAreaContext } from "@/components/forms/loss-form";
import { farmAreaLabels } from "@/lib/labels";
import { AREA_LOSS_TARGETS, AREA_SLUGS, isAreaSlug } from "@/lib/v2-navigation";

export default async function NewLossPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string | string[] }>;
}) {
  const { area } = await searchParams;
  const { farm } = await requireActiveFarm();

  // "Nuostolis" on an area's Nuostoliai tab opens this with ?area=<slug>
  // (#195). Without one it stays the V1 form.
  if (typeof area !== "string" || !isAreaSlug(area)) {
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

  const tabPath = `/areas/${area}/losses`;
  const areaContext: LossAreaContext = {
    area: AREA_SLUGS[area],
    areaLabel: farmAreaLabels[AREA_SLUGS[area]],
    target: {
      ...AREA_LOSS_TARGETS[area],
      options: await listAreaTargetOptions(farm.id, area, "loss"),
    },
  };

  return (
    <div>
      <PageHeader title="Naujas nuostolis" backHref={tabPath} />
      <div className="px-4">
        <LossForm areaContext={areaContext} onSuccessPath={tabPath} />
      </div>
    </div>
  );
}
