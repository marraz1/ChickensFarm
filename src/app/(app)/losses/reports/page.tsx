import { requireActiveFarm } from "@/lib/session";
import { getFlockReductionsReport } from "@/lib/services/reports";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { lossReasonLabels } from "@/lib/labels";

export default async function LossesReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const { farm } = await requireActiveFarm();

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const range = {
    from: from ? new Date(from) : defaultFrom,
    to: to ? new Date(to) : now,
  };

  const report = await getFlockReductionsReport(farm.id, range);

  return (
    <div>
      <PageHeader title="Nuostolių ataskaita" backHref="/finance" />
      <form className="flex gap-2 px-4 pb-2" method="get">
        <input
          type="date"
          name="from"
          defaultValue={range.from.toISOString().slice(0, 10)}
          className="h-11 flex-1 rounded-lg border px-3 text-sm"
        />
        <input
          type="date"
          name="to"
          defaultValue={range.to.toISOString().slice(0, 10)}
          className="h-11 flex-1 rounded-lg border px-3 text-sm"
        />
        <button type="submit" className="h-11 rounded-lg border px-3 text-sm font-medium">
          Filtruoti
        </button>
      </form>
      <div className="flex flex-col gap-3 px-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Iš viso prarasta (nugaišo)</p>
          <p className="text-2xl font-semibold">{report.lossesTotal}</p>
        </Card>
        {(Object.entries(lossReasonLabels) as [keyof typeof report.losses, string][]).map(
          ([key, label]) => (
            <Card key={key} className="flex flex-row items-center justify-between p-4">
              <span>{label}</span>
              <span className="text-lg font-semibold">{report.losses[key]}</span>
            </Card>
          ),
        )}

        {/* Every cause of a smaller flock, each on its own line. Sold birds and
            birds eaten at home are not losses, so they are listed here rather
            than folded into the mortality figures above. */}
        <p className="pt-3 text-sm font-medium text-muted-foreground">
          Paukščių sumažėjimas pagal priežastį
        </p>
        <Card className="flex flex-row items-center justify-between p-4">
          <span>Nugaišo</span>
          <span className="text-lg font-semibold">{report.lossesTotal}</span>
        </Card>
        <Card className="flex flex-row items-center justify-between p-4">
          <span>Parduota</span>
          <span className="text-lg font-semibold">{report.sold}</span>
        </Card>
        <Card className="flex flex-row items-center justify-between p-4">
          <span>Suvartota mėsai</span>
          <span className="text-lg font-semibold">{report.meatUse}</span>
        </Card>
        <Card className="flex flex-row items-center justify-between p-4">
          <span className="font-medium">Iš viso</span>
          <span className="text-lg font-semibold">{report.total}</span>
        </Card>
      </div>
    </div>
  );
}
