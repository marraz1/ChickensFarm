import Link from "next/link";
import { Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AreaBalanceCard } from "@/components/v2/area-balance-card";
import { AreaNewSheet } from "@/components/v2/area-new-sheet";
import { StatCard } from "@/components/v2/stat-card";
import { countNounLT } from "@/lib/format";
import { farmAreaLabels } from "@/lib/labels";
import { sittingDetail } from "@/lib/area-overview";
import { AREA_NEW_RECORDS } from "@/lib/v2-navigation";
import type { HensOverview } from "@/lib/services/area-overview";

const ENTRIES = ["įrašas", "įrašai", "įrašų"] as const;

// The Perekšlės Apžvalga tab (#188, V2-Hens-Overview).
export function HensAreaOverview({ data }: { data: HensOverview }) {
  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <div className="flex justify-end">
        <AreaNewSheet
          areaLabel={farmAreaLabels.HENS}
          items={AREA_NEW_RECORDS.hens}
          triggerLabel="Nauja"
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard
          label="Perekšlės"
          value={data.hens.length}
          detail={
            data.hens.length > 0 ? data.hens.map((h) => h.name).join(" · ") : "Nėra perekšlių"
          }
        />
        <StatCard
          label="Peri dabar"
          value={data.sitting.length}
          detail={sittingDetail(data.sitting)}
        />
      </div>

      <AreaBalanceCard area="hens" year={data.year} finance={data.balance} />

      <h2 className="pt-2 text-sm font-medium text-muted-foreground">Visos perekšlės</h2>
      {data.cards.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Dar nepridėta nė viena perekšlė.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {data.cards.map((hen) => (
            <li key={hen.id}>
              <Link href={`/mother-hens/${hen.id}`}>
                <Card className="overflow-hidden p-0">
                  {hen.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={hen.photoUrl} alt={hen.name} className="h-32 w-full object-cover" />
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center bg-accent">
                      <Heart size={28} className="text-muted-foreground" aria-hidden />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="truncate font-medium">{hen.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {hen.status} · {countNounLT(hen.logs, ENTRIES)}
                    </p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
