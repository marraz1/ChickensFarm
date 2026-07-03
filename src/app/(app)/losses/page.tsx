import Link from "next/link";
import { requireActiveFarm } from "@/lib/session";
import { listLosses } from "@/lib/services/losses";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { formatDateLT } from "@/lib/format";
import { lossReasonLabels } from "@/lib/labels";
import { Plus } from "lucide-react";

export default async function LossesPage() {
  const { farm } = await requireActiveFarm();
  const losses = await listLosses(farm.id);

  return (
    <div>
      <PageHeader
        title="Nuostoliai"
        backHref="/birds"
        action={
          <Link
            href="/losses/new"
            className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} aria-hidden /> Naujas
          </Link>
        }
      />
      <div className="flex flex-col gap-3 px-4">
        {losses.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Dar nėra įrašų.</p>
        )}
        {losses.map((loss) => (
          <Link key={loss.id} href={`/losses/${loss.id}/edit`}>
            <Card className="flex flex-row items-center justify-between p-4">
              <div>
                <p className="font-medium">
                  {lossReasonLabels[loss.reasonType]} · {formatDateLT(loss.lossDate)}
                </p>
                {loss.birdGroup && (
                  <p className="text-sm text-muted-foreground">{loss.birdGroup.breed.name}</p>
                )}
                {loss.comment && <p className="text-sm text-muted-foreground">{loss.comment}</p>}
              </div>
              <p className="text-lg font-semibold text-destructive">-{loss.quantity}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
