import Link from "next/link";
import { requireActiveFarm } from "@/lib/session";
import { listMotherHens } from "@/lib/services/mother-hens";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Plus, Heart } from "lucide-react";

export default async function MotherHensPage() {
  const { farm } = await requireActiveFarm();
  const hens = await listMotherHens(farm.id);

  return (
    <div>
      <PageHeader
        title="Perekšlės"
        backHref="/birds"
        action={
          <Link
            href="/mother-hens/new"
            className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} aria-hidden /> Nauja
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 px-4">
        {hens.length === 0 && (
          <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">
            Dar nepridėta nė viena perekšlė.
          </p>
        )}
        {hens.map((hen) => (
          <Link key={hen.id} href={`/mother-hens/${hen.id}`}>
            <Card className="overflow-hidden p-0">
              {hen.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hen.photoUrl} alt={hen.name} className="h-32 w-full object-cover" />
              ) : (
                <div className="flex h-32 w-full items-center justify-center bg-accent">
                  <Heart size={28} className="text-muted-foreground" aria-hidden />
                </div>
              )}
              <div className="p-3">
                <p className="truncate font-medium">{hen.name}</p>
                <p className="text-xs text-muted-foreground">
                  {hen._count.logs} įrašai
                  {hen.birdGroup ? ` · ${hen.birdGroup.breed.name}` : ""}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
