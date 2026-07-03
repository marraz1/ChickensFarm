import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getMotherHenWithLogs } from "@/lib/services/mother-hens";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { formatDateLT } from "@/lib/format";
import { Plus } from "lucide-react";

export default async function MotherHenDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { farm } = await requireActiveFarm();
  const hen = await getMotherHenWithLogs(farm.id, id);
  if (!hen) notFound();

  return (
    <div>
      <PageHeader
        title={hen.name}
        backHref="/mother-hens"
        action={
          <Link
            href={`/mother-hens/${hen.id}/logs/new`}
            className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} aria-hidden /> Įrašas
          </Link>
        }
      />
      <div className="flex flex-col gap-4 px-4">
        {hen.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hen.photoUrl} alt={hen.name} className="h-56 w-full rounded-lg border object-cover" />
        )}
        {(hen.description || hen.birdGroup) && (
          <Card className="p-4">
            {hen.birdGroup && (
              <p className="text-sm text-muted-foreground">Grupė: {hen.birdGroup.breed.name}</p>
            )}
            {hen.description && <p className="mt-1 text-sm">{hen.description}</p>}
          </Card>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Dienoraštis</p>
          {hen.logs.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Dar nėra įrašų. Pridėkite pirmąjį, kad matytumėte raidą.
            </p>
          )}
          <div className="flex flex-col gap-3">
            {hen.logs.map((log) => (
              <Card key={log.id} className="p-4">
                <p className="text-xs text-muted-foreground">{formatDateLT(log.entryDate)}</p>
                {log.note && <p className="mt-1 text-sm">{log.note}</p>}
                {log.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={log.photoUrl}
                    alt="Įrašo nuotrauka"
                    className="mt-2 h-48 w-full rounded-lg border object-cover"
                  />
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
