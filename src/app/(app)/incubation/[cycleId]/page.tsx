import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getIncubationCycle, computeCycleStats } from "@/lib/services/incubation";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { listBreeds } from "@/lib/services/breeds";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { CandlingForm } from "@/components/forms/candling-form";
import { HatchForm } from "@/components/forms/hatch-form";
import { formatDateLT, formatPercent } from "@/lib/format";
import { birdCategoryLabels } from "@/lib/labels";
import { Plus, CheckCircle2, Flag } from "lucide-react";

export default async function IncubationCycleDetailPage({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const { cycleId } = await params;
  const { farm } = await requireActiveFarm();
  const cycle = await getIncubationCycle(farm.id, cycleId);
  if (!cycle) notFound();

  const stats = computeCycleStats(cycle);
  const hatched = cycle.hatchDate != null;
  const growthDone = cycle.growthCompletedAt != null;
  const cohort = cycle.resultingGroup;
  const availableToDistribute = cohort ? cohort.quantity : cycle.hatchedCount ?? 0;
  const canFinish = hatched && !growthDone && availableToDistribute > 0;

  const [groups, breeds] = hatched
    ? [[], []]
    : await Promise.all([listBirdGroups(farm.id), listBreeds(farm.id)]);

  return (
    <div>
      <PageHeader title={cycle.name ?? "Perinimo ciklas"} backHref="/incubation" />
      <div className="flex flex-col gap-4 px-4">
        {/* Summary */}
        <Card className="p-4">
          <p className="font-medium">Pradėta {formatDateLT(cycle.startDate)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {cycle.eggSourceGroup
              ? `Šaltinis: ${cycle.eggSourceGroup.breed.name}`
              : cycle.sourceDescription || "Šaltinis nenurodytas"}
            {cycle.eggsTotal != null ? ` · ${cycle.eggsTotal} kiaušinių` : ""}
          </p>
          {cycle.notes && <p className="mt-2 text-sm">{cycle.notes}</p>}
        </Card>

        {/* Efficiency stats (F10.5) */}
        <Card className="flex flex-row items-center justify-around p-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Apvaisinimo %</p>
            <p className="text-lg font-semibold">{formatPercent(stats.fertilityRate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Išsiritimo %</p>
            <p className="text-lg font-semibold">{formatPercent(stats.hatchRate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Išgyvenamumo %</p>
            <p className="text-lg font-semibold">{formatPercent(stats.survivalRate)}</p>
          </div>
        </Card>

        {/* Candling (F10.2) */}
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Apšvietimas / patikra</p>
          <Card className="p-4">
            <CandlingForm
              cycleId={cycle.id}
              defaultValues={{
                eggsFertile: cycle.eggsFertile ?? 0,
                eggsInfertile: cycle.eggsInfertile ?? 0,
              }}
            />
          </Card>
        </div>

        {/* Hatch (F10.3) */}
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Išsiritimas</p>
          <Card className="p-4">
            {hatched ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm">
                  Išsirito <span className="font-semibold">{cycle.hatchedCount}</span> jauniklių{" "}
                  {cycle.hatchDate && `(${formatDateLT(cycle.hatchDate)})`}
                </p>
                {cycle.resultingGroup && (
                  <Link
                    href={`/bird-groups/${cycle.resultingGroup.id}`}
                    className="text-sm text-primary underline"
                  >
                    Grupė: {cycle.resultingGroup.breed.name}
                  </Link>
                )}
              </div>
            ) : (
              <HatchForm
                cycleId={cycle.id}
                breeds={breeds.map((b) => ({ id: b.id, label: b.name }))}
                birdGroups={groups.map((g) => ({ id: g.id, label: g.breed.name }))}
              />
            )}
          </Card>
        </div>

        {/* Growth logs (F10.4) — only once hatched */}
        {hatched && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Jauniklių sekimas</p>
                {cohort && (
                  <p className="text-xs text-muted-foreground">
                    Grupė: {birdCategoryLabels[cohort.category]} · {cohort.quantity} vnt.
                  </p>
                )}
              </div>
              {!growthDone && (
                <Link
                  href={`/incubation/${cycle.id}/growth-logs/new`}
                  className="flex h-9 items-center gap-1 rounded-lg border px-3 text-sm font-medium"
                >
                  <Plus size={14} aria-hidden /> Įrašas
                </Link>
              )}
            </div>

            {growthDone ? (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle2 size={18} aria-hidden />
                Auginimas baigtas {cycle.growthCompletedAt && formatDateLT(cycle.growthCompletedAt)}
              </div>
            ) : (
              canFinish && (
                <Link
                  href={`/incubation/${cycle.id}/finish`}
                  className="mb-3 flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
                >
                  <Flag size={16} aria-hidden /> Užbaigti sekimą
                </Link>
              )
            )}

            {cycle.growthLogs.length === 0 && !growthDone && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Dar nėra sekimo įrašų.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {cycle.growthLogs.map((log) => (
                <Card key={log.id} className="flex flex-row items-center justify-between p-3">
                  <div>
                    <p className="text-sm">{formatDateLT(log.logDate)}</p>
                    {log.note && <p className="text-xs text-muted-foreground">{log.note}</p>}
                  </div>
                  <p className="text-lg font-semibold">{log.aliveCount}</p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
