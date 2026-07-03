import Link from "next/link";
import { requireActiveFarm } from "@/lib/session";
import { listEggConsumptions } from "@/lib/services/egg-consumptions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { formatDateLT } from "@/lib/format";
import { Plus } from "lucide-react";

export default async function EggConsumptionsPage() {
  const { farm } = await requireActiveFarm();
  const consumptions = await listEggConsumptions(farm.id);

  return (
    <div>
      <PageHeader
        title="Suvartoti kiaušiniai"
        backHref="/birds"
        action={
          <Link
            href="/eggs/consumptions/new"
            className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} aria-hidden /> Naujas
          </Link>
        }
      />
      <div className="flex flex-col gap-3 px-4">
        {consumptions.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Dar nėra įrašų.</p>
        )}
        {consumptions.map((c) => (
          <Card key={c.id} className="flex flex-row items-center justify-between p-4">
            <div>
              <p className="font-medium">{formatDateLT(c.consumptionDate)}</p>
              {c.note && <p className="text-sm text-muted-foreground">{c.note}</p>}
            </div>
            <p className="text-lg font-semibold">{c.quantity}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
