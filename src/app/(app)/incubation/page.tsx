import Link from "next/link";
import { requireActiveFarm } from "@/lib/session";
import { listIncubationCycles, getIncubationOverview } from "@/lib/services/incubation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { formatDateLT, formatPercent } from "@/lib/format";
import { Plus, Egg } from "lucide-react";

function statusLabel(cycle: { hatchDate: Date | null; eggsFertile: number | null }): {
  text: string;
  className: string;
} {
  if (cycle.hatchDate) return { text: "Išsiritę", className: "bg-emerald-100 text-emerald-700" };
  if (cycle.eggsFertile != null) return { text: "Apšviesta", className: "bg-amber-100 text-amber-700" };
  return { text: "Pradėta", className: "bg-muted text-muted-foreground" };
}

export default async function IncubationListPage() {
  const { farm } = await requireActiveFarm();
  const [cycles, overview] = await Promise.all([
    listIncubationCycles(farm.id),
    getIncubationOverview(farm.id),
  ]);

  return (
    <div>
      <PageHeader
        title="Perinimas"
        action={
          <Link
            href="/incubation/new"
            className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} aria-hidden /> Naujas
          </Link>
        }
      />

      {overview.totalHatched > 0 && (
        <div className="px-4 pb-2">
          <Card className="flex flex-row items-center justify-around p-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Išsirito</p>
              <p className="text-lg font-semibold">{overview.totalHatched}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Iš apvaisintų</p>
              <p className="text-lg font-semibold">{overview.totalFertile}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Efektyvumas</p>
              <p className="text-lg font-semibold">{formatPercent(overview.overallHatchRate)}</p>
            </div>
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-3 px-4">
        {cycles.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Egg size={36} aria-hidden />
            <p className="text-sm">Dar nėra perinimo ciklų.</p>
          </div>
        )}
        {cycles.map((cycle) => {
          const status = statusLabel(cycle);
          return (
            <Link key={cycle.id} href={`/incubation/${cycle.id}`}>
              <Card className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">
                    {cycle.name ?? `Pradėta ${formatDateLT(cycle.startDate)}`}
                  </p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                    {status.text}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Pradėta {formatDateLT(cycle.startDate)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {cycle.eggSourceGroup
                    ? `Šaltinis: ${cycle.eggSourceGroup.breed.name}`
                    : cycle.sourceDescription || "Šaltinis nenurodytas"}
                  {cycle.eggsTotal != null ? ` · ${cycle.eggsTotal} kiaušinių` : ""}
                </p>
                {cycle.hatchDate && cycle.hatchedCount != null && (
                  <p className="mt-1 text-sm text-emerald-600">
                    Išsirito {cycle.hatchedCount}
                    {cycle.growthLogs[0] ? ` · dabar gyvų ${cycle.growthLogs[0].aliveCount}` : ""}
                  </p>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
