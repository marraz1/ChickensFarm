import Link from "next/link";
import { requireActiveFarm } from "@/lib/session";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { birdTypeLabels, sexLabels, birdCategoryLabels } from "@/lib/labels";
import { formatDateLT } from "@/lib/format";
import { Plus } from "lucide-react";

function computeAge(birthOrAcquiredDate: Date): string {
  const now = new Date();
  const days = Math.floor((now.getTime() - birthOrAcquiredDate.getTime()) / 86_400_000);
  if (days < 0) return "";
  if (days < 60) return `${days} d.`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} mėn.`;
  return `${Math.floor(months / 12)} m.`;
}

export default async function BirdGroupsPage() {
  const { farm } = await requireActiveFarm();
  const groups = await listBirdGroups(farm.id);

  return (
    <div>
      <PageHeader
        title="Paukščių grupės"
        backHref="/birds"
        action={
          <Link
            href="/bird-groups/new"
            className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} aria-hidden /> Nauja
          </Link>
        }
      />
      <div className="flex flex-col gap-3 px-4">
        {groups.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Dar nepridėta nė viena paukščių grupė.
          </p>
        )}
        {groups.map((group) => (
          <Link key={group.id} href={`/bird-groups/${group.id}`}>
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{group.name || group.breed.name}</p>
                <span className="text-lg font-semibold">{group.quantity}</span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {group.breed.name} · {birdTypeLabels[group.breed.birdType]}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {group.category !== "OTHER" ? `${birdCategoryLabels[group.category]} · ` : ""}
                {sexLabels[group.sex]} · {computeAge(group.birthOrAcquiredDate)} · nuo{" "}
                {formatDateLT(group.birthOrAcquiredDate)}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
