import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getMotherHenWithLogs } from "@/lib/services/mother-hens";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { MotherHenForm } from "@/components/forms/mother-hen-form";
import { DeleteRecordButton } from "@/components/forms/delete-record-button";

export default async function EditMotherHenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { farm } = await requireActiveFarm();
  const [hen, groups] = await Promise.all([
    getMotherHenWithLogs(farm.id, id),
    listBirdGroups(farm.id),
  ]);
  if (!hen) notFound();

  return (
    <div>
      <PageHeader title="Koreguoti perekšlę" backHref={`/mother-hens/${hen.id}`} />
      <div className="flex flex-col gap-6 px-4">
        <MotherHenForm
          birdGroups={groups.map((g) => ({ id: g.id, label: g.breed.name }))}
          henId={hen.id}
          defaultValues={{
            name: hen.name,
            birdGroupId: hen.birdGroupId ?? "",
            photoUrl: hen.photoUrl ?? "",
            description: hen.description ?? "",
          }}
          onSuccessPath={`/mother-hens/${hen.id}`}
        />
        <DeleteRecordButton
          endpoint={`/api/mother-hens/${hen.id}`}
          redirectTo="/mother-hens"
          triggerLabel="Ištrinti perekšlę"
          title="Ištrinti perekšlę?"
          description="Perekšlė ir visi jos dienoraščio įrašai bus visam laikui ištrinti. Šio veiksmo atšaukti nepavyks."
        />
      </div>
    </div>
  );
}
