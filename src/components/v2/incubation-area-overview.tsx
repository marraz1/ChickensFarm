import Link from "next/link";
import { Card } from "@/components/ui/card";
import { AreaBalanceCard } from "@/components/v2/area-balance-card";
import { AreaNewSheet } from "@/components/v2/area-new-sheet";
import { StatCard } from "@/components/v2/stat-card";
import { countNounLT, formatShareLT } from "@/lib/format";
import { farmAreaLabels } from "@/lib/labels";
import { incubationSheetItems, type CycleStatus } from "@/lib/area-overview";
import { AREA_NEW_RECORDS } from "@/lib/v2-navigation";
import { cn } from "@/lib/utils";
import type { IncubationOverview } from "@/lib/services/area-overview";

const EGGS = ["kiaušinis", "kiaušiniai", "kiaušinių"] as const;

// The same colours as the V1 cycle list.
const BADGE: Record<CycleStatus, string> = {
  Pradėta: "bg-muted text-muted-foreground",
  Apšviesta: "bg-amber-100 text-amber-700",
  Išsiritę: "bg-emerald-100 text-emerald-700",
};

// The Perinimas Apžvalga tab (#189, V2-Inc-Overview). "Naujas ciklas" opens
// the "Naujas įrašas" sheet, as the design links it; its first action is the
// new-cycle form.
export function IncubationAreaOverview({ data }: { data: IncubationOverview }) {
  const { efficiency } = data;
  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <div className="flex justify-end">
        <AreaNewSheet
          areaLabel={farmAreaLabels.INC}
          items={incubationSheetItems(AREA_NEW_RECORDS.incubation, data.sheet)}
          triggerLabel="Naujas ciklas"
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard
          label="Aktyvūs ciklai"
          value={data.active.count}
          detail={
            data.active.count > 0
              ? `${countNounLT(data.active.eggs, EGGS)} inkubatoriuje`
              : "Nėra aktyvių ciklų"
          }
        />
        <StatCard
          label="Efektyvumas"
          value={efficiency.rate == null ? "—" : formatShareLT(efficiency.rate)}
          detail={
            efficiency.rate == null
              ? "Dar nėra išsiritimų"
              : `Išsirito ${efficiency.hatched} iš ${efficiency.fertile} apvaisintų`
          }
        />
      </div>

      <AreaBalanceCard area="incubation" year={data.year} finance={data.balance} />

      <h2 className="pt-2 text-sm font-medium text-muted-foreground">Ciklai</h2>
      {data.cards.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Dar nėra perinimo ciklų.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.cards.map((cycle) => (
            <li key={cycle.id}>
              <Link href={`/incubation/${cycle.id}`}>
                <Card className="gap-0.5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{cycle.name}</p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        BADGE[cycle.status],
                      )}
                    >
                      {cycle.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{cycle.lines.started}</p>
                  <p className="text-sm text-muted-foreground">{cycle.lines.source}</p>
                  {cycle.lines.result && (
                    <p className="text-sm text-emerald-600">{cycle.lines.result}</p>
                  )}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
