import Link from "next/link";
import { requireActiveFarm } from "@/lib/session";
import { listEggCollections } from "@/lib/services/egg-collections";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { formatDateLT } from "@/lib/format";
import { Plus } from "lucide-react";

export default async function EggCollectionsPage() {
  const { farm } = await requireActiveFarm();
  const collections = await listEggCollections(farm.id);

  return (
    <div>
      <PageHeader
        title="Kiaušinių surinkimas"
        backHref="/birds"
        action={
          <Link
            href="/eggs/collections/new"
            className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} aria-hidden /> Nauja
          </Link>
        }
      />
      <div className="flex flex-col gap-3 px-4">
        {collections.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Dar nėra įrašų.</p>
        )}
        {collections.map((c) => (
          <Link key={c.id} href={`/eggs/collections/${c.id}/edit`}>
            <Card className="flex flex-row items-center justify-between p-4">
              <div>
                <p className="font-medium">{formatDateLT(c.collectionDate)}</p>
                {c.birdGroup && (
                  <p className="text-sm text-muted-foreground">{c.birdGroup.breed.name}</p>
                )}
              </div>
              <p className="text-lg font-semibold">{c.quantity}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
