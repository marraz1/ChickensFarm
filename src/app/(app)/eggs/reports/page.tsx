import { requireActiveFarm } from "@/lib/session";
import { getEggStockReport } from "@/lib/services/egg-sales";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { formatEUR } from "@/lib/format";

export default async function EggReportsPage({
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

  const report = await getEggStockReport(farm.id, range);

  return (
    <div>
      <PageHeader title="Kiaušinių ataskaita" backHref="/finance" />
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
          <p className="text-sm text-muted-foreground">Surinkta laikotarpiu</p>
          <p className="text-2xl font-semibold">{report.collectedInPeriod}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Parduota laikotarpiu</p>
          <p className="text-2xl font-semibold">{report.soldInPeriod}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Pajamos laikotarpiu</p>
          <p className="text-2xl font-semibold text-emerald-600">{formatEUR(report.revenueInPeriod)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Likutis sandėlyje (viso)</p>
          <p className="text-2xl font-semibold">{report.remainingStock}</p>
        </Card>
      </div>
    </div>
  );
}
