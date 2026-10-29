import { notFound } from "next/navigation";
import { AreaBalanceCard } from "@/components/v2/area-balance-card";
import { AreaNewSheet } from "@/components/v2/area-new-sheet";
import { RecordLinks } from "@/components/v2/record-links";
import { StatCard } from "@/components/v2/stat-card";
import { requireActiveFarm } from "@/lib/session";
import { HensAreaOverview } from "@/components/v2/hens-area-overview";
import { IncubationAreaOverview } from "@/components/v2/incubation-area-overview";
import { MeatAreaOverview } from "@/components/v2/meat-area-overview";
import {
  getEggsOverview,
  getHensOverview,
  getIncubationAreaOverview,
  getMeatOverview,
  type EggsOverview,
} from "@/lib/services/area-overview";
import { farmAreaLabels } from "@/lib/labels";
import { formatEUR } from "@/lib/format";
import {
  AREA_NEW_RECORDS,
  AREA_RECORD_LINKS,
  AREA_SLUGS,
  isAreaSlug,
  type EggsStatKey,
} from "@/lib/v2-navigation";

// An area's Apžvalga tab: Kiaušiniai (#187), Perekšlės (#188), Perinimas
// (#189) and Mėsa (#190).
export default async function AreaOverviewPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  if (!isAreaSlug(area)) notFound();

  const { farm } = await requireActiveFarm();
  switch (area) {
    case "eggs":
      return <EggsAreaOverview data={await getEggsOverview(farm.id)} />;
    case "hens":
      return <HensAreaOverview data={await getHensOverview(farm.id)} />;
    case "incubation":
      return <IncubationAreaOverview data={await getIncubationAreaOverview(farm.id)} />;
    case "meat":
      return <MeatAreaOverview data={await getMeatOverview(farm.id)} />;
  }
}

function EggsAreaOverview({ data }: { data: EggsOverview }) {
  // Every Kiaušiniai key must be filled: a renamed or missing one is a type error.
  const statValues: Record<EggsStatKey, string> = {
    collected: `${data.stats.collected} šį mėn.`,
    eggSales: formatEUR(data.stats.eggSales),
    eggsConsumed: String(data.stats.eggsConsumed),
    purchases: formatEUR(data.stats.purchases),
    birdSales: formatEUR(data.stats.birdSales),
    groups: String(data.stats.groups),
  };

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <div className="flex justify-end">
        <AreaNewSheet areaLabel={farmAreaLabels[AREA_SLUGS.eggs]} items={AREA_NEW_RECORDS.eggs} />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard
          label="Kiaušinių likutis"
          value={data.eggStock}
          detail={`Šį mėn. ${data.collectedThisMonth} · Metais ${data.collectedThisYear}`}
        />
        <StatCard
          label="Dedeklių pulkas"
          value={data.flock.total}
          detail={
            data.flock.byBreed.length > 0
              ? data.flock.byBreed.map((part) => `${part.name} ${part.quantity}`).join(" · ")
              : "Nėra paukščių"
          }
        />
      </div>

      <AreaBalanceCard area="eggs" year={data.year} finance={data.balance} />

      <h2 className="pt-2 text-sm font-medium text-muted-foreground">Įrašai</h2>
      <RecordLinks links={AREA_RECORD_LINKS.eggs} values={statValues} />
    </div>
  );
}
