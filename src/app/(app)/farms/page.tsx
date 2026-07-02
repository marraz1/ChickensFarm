import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listFarmsForUser } from "@/lib/services/farms";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";

export default async function FarmsPage() {
  const user = await requireUser();
  const farms = await listFarmsForUser(user.id);

  return (
    <div>
      <PageHeader
        title="Mano ūkiai"
        backHref="/"
        action={
          <Link
            href="/farms/new"
            className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} aria-hidden /> Naujas
          </Link>
        }
      />
      <div className="flex flex-col gap-3 px-4">
        {farms.map((farm) => (
          <Link key={farm.id} href={`/farms/${farm.id}/settings`}>
            <Card className="p-4">
              <p className="font-medium">{farm.name}</p>
              {farm.location && <p className="text-sm text-muted-foreground">{farm.location}</p>}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
