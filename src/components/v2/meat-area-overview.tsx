import Link from "next/link";
import { Card } from "@/components/ui/card";
import { AreaBalanceCard } from "@/components/v2/area-balance-card";
import { AreaNewSheet } from "@/components/v2/area-new-sheet";
import { RecordLinks } from "@/components/v2/record-links";
import { StatCard } from "@/components/v2/stat-card";
import { formatEUR, formatLongDateLT } from "@/lib/format";
import { farmAreaLabels } from "@/lib/labels";
import { AREA_NEW_RECORDS, AREA_RECORD_LINKS, type MeatStatKey } from "@/lib/v2-navigation";
import type { MeatOverview } from "@/lib/services/area-overview";

// The Mėsa Apžvalga tab (#190, V2-Meat-Overview).
export function MeatAreaOverview({ data }: { data: MeatOverview }) {
  // Every Mėsa key must be filled: a renamed or missing one is a type error.
  const statValues: Record<MeatStatKey, string> = {
    groups: String(data.stats.groups),
    consumed: String(data.stats.consumed),
    sales: formatEUR(data.stats.sales),
  };

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <div className="flex justify-end">
        <AreaNewSheet areaLabel={farmAreaLabels.MEAT} items={AREA_NEW_RECORDS.meat} />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard
          label="Auginama mėsai"
          value={data.raising.total}
          detail={
            data.raising.byGroup.length > 0
              ? data.raising.byGroup.map((part) => `${part.name} ${part.quantity}`).join(" · ")
              : "Nėra paukščių"
          }
        />
        <StatCard
          label="Suvartota mėsai"
          value={data.homeUse.year}
          detail={`Šį mėn. ${data.homeUse.month} · Metais ${data.homeUse.year}`}
        />
      </div>

      <AreaBalanceCard area="meat" year={data.year} finance={data.balance} />

      <h2 className="pt-2 text-sm font-medium text-muted-foreground">Įrašai</h2>
      <RecordLinks links={AREA_RECORD_LINKS.meat} values={statValues} />

      <section aria-labelledby="meat-recent" className="flex flex-col gap-2">
        <h2 id="meat-recent" className="pt-2 text-sm font-medium text-muted-foreground">
          Paskutiniai įrašai
        </h2>
        {data.recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Dar nėra įrašų.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.recent.map((record) => (
              <li key={record.id}>
                <Link href={`/birds/consumptions/${record.id}/edit`}>
                  <Card className="flex flex-row items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Suvartota · {formatLongDateLT(record.date)}
                      </p>
                      <p className="font-medium">{record.groupLabel}</p>
                    </div>
                    <span className="font-medium tabular-nums">−{record.quantity}</span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
