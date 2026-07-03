import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getBirdGroupWithEvents } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { birdTypeLabels, sexLabels, birdCategoryLabels } from "@/lib/labels";
import { formatDateLT, formatRelativeLT } from "@/lib/format";
import { Pencil } from "lucide-react";

const EVENT_LABELS: Record<string, string> = {
  INITIAL: "Grupė sukurta",
  MANUAL_ADJUSTMENT: "Rankinė korekcija",
  LOSS: "Nuostolis",
  INCUBATION_HATCH: "Išsiritimas",
};

export default async function BirdGroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const { farm } = await requireActiveFarm();
  const group = await getBirdGroupWithEvents(farm.id, groupId);
  if (!group) notFound();

  return (
    <div>
      <PageHeader
        title={group.breed.name}
        backHref="/bird-groups"
        action={
          <Link
            href={`/bird-groups/${group.id}/edit`}
            className="flex h-11 items-center gap-1 rounded-lg border px-3 text-sm font-medium"
          >
            <Pencil size={16} aria-hidden /> Koreguoti
          </Link>
        }
      />
      <div className="flex flex-col gap-4 px-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Dabartinis kiekis</p>
            <p className="text-2xl font-semibold">{group.quantity}</p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {birdCategoryLabels[group.category]} · {birdTypeLabels[group.breed.birdType]} ·{" "}
            {sexLabels[group.sex]}
          </p>
          <p className="text-sm text-muted-foreground">
            Nuo {formatDateLT(group.birthOrAcquiredDate)}
          </p>
          {group.notes && <p className="mt-2 text-sm">{group.notes}</p>}
        </Card>

        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Istorija</p>
          <div className="flex flex-col">
            {group.events.map((event) => (
              <div key={event.id} className="flex items-center gap-3 border-t py-3 first:border-t-0">
                <div className="flex-1">
                  <p className="text-sm">
                    {EVENT_LABELS[event.eventType] ?? event.eventType}{" "}
                    <span className={event.quantityDelta >= 0 ? "text-emerald-600" : "text-destructive"}>
                      {event.quantityDelta >= 0 ? "+" : ""}
                      {event.quantityDelta}
                    </span>
                  </p>
                  {event.note && <p className="text-sm text-muted-foreground">{event.note}</p>}
                  <p className="text-xs text-muted-foreground">{formatRelativeLT(event.createdAt)}</p>
                </div>
                <p className="text-sm text-muted-foreground">{event.quantityAfter}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
