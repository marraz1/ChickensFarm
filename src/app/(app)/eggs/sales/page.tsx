import Link from "next/link";
import { requireActiveFarm } from "@/lib/session";
import { listEggSales } from "@/lib/services/egg-sales";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { formatDateLT, formatEUR } from "@/lib/format";
import { Plus } from "lucide-react";

export default async function EggSalesPage() {
  const { farm } = await requireActiveFarm();
  const sales = await listEggSales(farm.id);

  return (
    <div>
      <PageHeader
        title="Kiaušinių pardavimai"
        backHref="/finance"
        action={
          <Link
            href="/eggs/sales/new"
            className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} aria-hidden /> Naujas
          </Link>
        }
      />
      <div className="flex flex-col gap-3 px-4">
        {sales.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Dar nėra pardavimų.</p>
        )}
        {sales.map((sale) => (
          <Link key={sale.id} href={`/eggs/sales/${sale.id}/edit`}>
            <Card className="flex flex-row items-center justify-between p-4">
              <div>
                <p className="font-medium">{formatDateLT(sale.saleDate)}</p>
                <p className="text-sm text-muted-foreground">
                  {sale.quantity} vnt. × {formatEUR(sale.unitPrice)}
                  {sale.buyer ? ` · ${sale.buyer}` : ""}
                </p>
              </div>
              <p className="text-lg font-semibold text-emerald-600">{formatEUR(sale.totalAmount)}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
