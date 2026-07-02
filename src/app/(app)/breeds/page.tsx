import Link from "next/link";
import { requireActiveFarm } from "@/lib/session";
import { listBreeds } from "@/lib/services/breeds";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { birdTypeLabels } from "@/lib/labels";
import { Plus } from "lucide-react";

export default async function BreedsPage() {
  const { farm } = await requireActiveFarm();
  const breeds = await listBreeds(farm.id);

  return (
    <div>
      <PageHeader
        title="Veislės"
        backHref="/birds"
        action={
          <Link
            href="/breeds/new"
            className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} aria-hidden /> Nauja
          </Link>
        }
      />
      <div className="flex flex-col gap-3 px-4">
        {breeds.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Dar nepridėta nė viena veislė.
          </p>
        )}
        {breeds.map((breed) => (
          <Link key={breed.id} href={`/breeds/${breed.id}/edit`}>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{breed.name}</p>
                <span className="text-xs text-muted-foreground">{birdTypeLabels[breed.birdType]}</span>
              </div>
              {breed.description && (
                <p className="mt-1 text-sm text-muted-foreground">{breed.description}</p>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
