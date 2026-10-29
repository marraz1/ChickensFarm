import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AreaBalanceCard } from "@/components/v2/area-balance-card";
import { AreaNewSheet } from "@/components/v2/area-new-sheet";
import { StatCard } from "@/components/v2/stat-card";
import { requireActiveFarm } from "@/lib/session";
import { getEggsOverview, type EggsOverview } from "@/lib/services/area-overview";
import { farmAreaLabels } from "@/lib/labels";
import { formatEUR } from "@/lib/format";
import {
  AREA_NEW_RECORDS,
  AREA_RECORD_LINKS,
  AREA_SLUGS,
  isAreaSlug,
  type AreaRecordLink,
} from "@/lib/v2-navigation";

// An area's Apžvalga tab. Kiaušiniai has its overview (#187, V2-Eggs-Overview);
// the other areas list their V1 screens until #188–#190 build theirs — each
// screen has its own add button, so records stay reachable meanwhile.
export default async function AreaOverviewPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  if (!isAreaSlug(area)) notFound();

  if (area === "eggs") {
    const { farm } = await requireActiveFarm();
    return <EggsAreaOverview data={await getEggsOverview(farm.id)} />;
  }

  return (
    <div className="flex flex-col gap-3 px-4">
      <h2 className="text-sm font-medium text-muted-foreground">Įrašai</h2>
      <RecordLinks links={AREA_RECORD_LINKS[area]} />
    </div>
  );
}

function EggsAreaOverview({ data }: { data: EggsOverview }) {
  const statValues: Record<string, string> = {
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
        <AreaNewSheet areaLabel={farmAreaLabels[AREA_SLUGS.eggs]} items={AREA_NEW_RECORDS.eggs!} />
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

function RecordLinks({
  links,
  values = {},
}: {
  links: readonly AreaRecordLink[];
  values?: Record<string, string>;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href}>
            <Card className="flex min-h-11 flex-row items-center gap-3 p-4">
              <span className="flex-1 font-medium">{link.label}</span>
              {link.stat && values[link.stat] != null && (
                <span className="text-sm text-muted-foreground tabular-nums">
                  {values[link.stat]}
                </span>
              )}
              <ChevronRight size={18} className="text-muted-foreground" aria-hidden />
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
