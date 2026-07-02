import { requireActiveFarm } from "@/lib/session";
import { getLossesByReasonReport } from "@/lib/services/losses";
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

  const totals = await getLossesByReasonReport(farm.id, range);
  const total = totals.DISEASE + totals.PREDATOR + totals.OTHER;

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
          <p className="text-sm text-muted-foreground">Iš viso prarasta</p>
          <p className="text-2xl font-semibold">{total}</p>
        </Card>
        {(Object.entries(lossReasonLabels) as [keyof typeof totals, string][]).map(([key, label]) => (
          <Card key={key} className="flex flex-row items-center justify-between p-4">
            <span>{label}</span>
            <span className="text-lg font-semibold">{totals[key]}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
