import Link from "next/link";
import { requireActiveFarm } from "@/lib/session";
import { getFarmNow } from "@/lib/services/dashboard";
import { getFarmFinance } from "@/lib/services/area-finance";
import { getAreaLossCounts } from "@/lib/services/losses";
import { resolveFinancePeriod, type SearchParam } from "@/lib/finance-period";
import { Card } from "@/components/ui/card";
import { PeriodSwitch } from "@/components/v2/period-switch";
import { formatEUR } from "@/lib/format";
import { AreaSplitCard } from "@/components/v2/area-split-card";
import { areaSplits } from "@/lib/area-split";
import { AreaTiles } from "@/components/v2/area-tiles";
import { areaTiles } from "@/lib/area-tiles";
import { FarmNow } from "@/components/v2/farm-now";
import { MoreStats } from "@/components/v2/more-stats";
import { farmStats } from "@/lib/farm-stats";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

// The V2 farm overview (V2-Overview): the title with "Išlaida", the period
// switch and the farm result (#201), spending and income by area (#202), the
// area tiles (#203), then "Ūkis dabar" and "Daugiau statistikos" (#204).
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: SearchParam; from?: SearchParam; to?: SearchParam }>;
}) {
  const [query, { farm }] = await Promise.all([searchParams, requireActiveFarm()]);
  const period = resolveFinancePeriod(query);
  const [now, finance, losses] = await Promise.all([
    getFarmNow(farm.id),
    getFarmFinance(farm.id, period),
    getAreaLossCounts(farm.id, period),
  ]);
  const { income, expenses, result } = finance.total;
  const heading = `${result >= 0 ? "Pelnas" : "Nuostolis"} · ${period.label}`;

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex items-center justify-between gap-3 px-4">
        <h1 className="text-lg font-semibold">Ūkio apžvalga</h1>
        {/* The general form, which asks for the area, "Bendra" included (#193). */}
        <Link
          href="/expenses/new"
          className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          <Plus size={16} aria-hidden /> Išlaida
        </Link>
      </div>

      <div className="px-4">
        <PeriodSwitch basePath="/" period={period} />
      </div>

      <div className="px-4">
        <Card className="gap-1 p-4" role="region" aria-label={heading}>
          <p className="text-sm text-muted-foreground">{heading}</p>
          <p
            className={cn(
              "text-3xl font-semibold tabular-nums",
              result >= 0 ? "text-emerald-600" : "text-destructive",
            )}
          >
            {formatEUR(result)}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3 border-t pt-3">
            <div role="region" aria-label="Pajamos">
              <p className="text-xs text-muted-foreground">Pajamos</p>
              <p className="text-base font-semibold tabular-nums text-emerald-600">
                {formatEUR(income)}
              </p>
            </div>
            <div role="region" aria-label="Išlaidos">
              <p className="text-xs text-muted-foreground">Išlaidos</p>
              <p className="text-base font-semibold tabular-nums">{formatEUR(expenses)}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="px-4">
        {/* Both views worked out here; the card only picks one and draws it. */}
        <AreaSplitCard splits={areaSplits(finance.areas)} />
      </div>

      <div className="px-4">
        <AreaTiles tiles={areaTiles(finance.areas, losses)} />
      </div>

      <div className="px-4">
        <FarmNow data={now} />
      </div>

      <div className="px-4">
        <MoreStats stats={farmStats(finance.areas)} />
      </div>
    </div>
  );
}
