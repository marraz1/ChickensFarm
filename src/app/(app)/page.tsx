import Link from "next/link";
import { requireActiveFarm } from "@/lib/session";
import { getDashboardData } from "@/lib/services/dashboard";
import { getFarmFinance } from "@/lib/services/area-finance";
import { resolveFinancePeriod, type SearchParam } from "@/lib/finance-period";
import { Card } from "@/components/ui/card";
import { PeriodSwitch } from "@/components/v2/period-switch";
import { formatEUR, formatRelativeLT } from "@/lib/format";
import { birdTypeLabels } from "@/lib/labels";
import { AreaSplitCard } from "@/components/v2/area-split-card";
import { areaSplits } from "@/lib/area-split";
import { cn } from "@/lib/utils";
import { Egg, AlertTriangle, Heart, Drumstick, Plus } from "lucide-react";

const ACTIVITY_ICONS = {
  EGG_COLLECTION: Egg,
  LOSS: AlertTriangle,
  MEAT_USE: Drumstick,
  MOTHER_HEN_LOG: Heart,
} as const;

// The V2 farm overview (V2-Overview): the title with "Išlaida", the period
// switch and the farm result (#201), then spending and income by area (#202).
// The area tiles (#203) and "Ūkis dabar"/"Daugiau statistikos" (#204) come
// later; until then the V1 dashboard's counts and recent activity stay below.
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: SearchParam; from?: SearchParam; to?: SearchParam }>;
}) {
  const [query, { farm }] = await Promise.all([searchParams, requireActiveFarm()]);
  const period = resolveFinancePeriod(query);
  const [data, finance] = await Promise.all([
    getDashboardData(farm.id),
    getFarmFinance(farm.id, period),
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

      <div className="grid grid-cols-2 gap-2.5 px-4">
        <Card className="p-3">
          <p className="mb-1 text-xs text-muted-foreground">Paukščių iš viso</p>
          <p className="text-xl font-medium">{data.totalBirds}</p>
          <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
            {data.birdsByType.length > 0
              ? data.birdsByType
                  .map((entry) => `${birdTypeLabels[entry.birdType]} ${entry.quantity}`)
                  .join(" · ")
              : "Nėra paukščių"}
          </p>
        </Card>
        <Card className="p-3">
          <p className="mb-1 text-xs text-muted-foreground">Kiaušinių likutis</p>
          <p className="text-xl font-medium">{data.eggsRemaining}</p>
          <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
            Šį mėn. {data.eggsThisMonth} · Metais {data.eggsThisYear}
          </p>
        </Card>
        {/* Odd card out in a 2-column grid — span both so no empty cell is left. */}
        <Card className="col-span-2 p-3">
          <p className="mb-1 text-xs text-muted-foreground">Aktyvus perinimas</p>
          <p className="text-xl font-medium">{data.activeIncubationCount} ciklai</p>
        </Card>
      </div>

      <div className="px-4 pt-1">
        <p className="mb-2 text-sm text-muted-foreground">Paskutiniai įrašai</p>
        <div className="flex flex-col">
          {data.activity.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Dar nėra jokios veiklos.
            </p>
          )}
          {data.activity.map((item) => {
            const Icon = ACTIVITY_ICONS[item.type];
            return (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-3 border-t py-3 first:border-t-0"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
                  <Icon size={16} className="text-accent-foreground" aria-hidden />
                </div>
                <div className="flex-1">
                  <p className="text-sm">{item.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeLT(item.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
