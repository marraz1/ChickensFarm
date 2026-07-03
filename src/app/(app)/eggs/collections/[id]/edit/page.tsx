import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getEggCollection } from "@/lib/services/egg-collections";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { EggCollectionForm } from "@/components/forms/egg-collection-form";
import { DeleteRecordButton } from "@/components/forms/delete-record-button";

export default async function EditEggCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { farm } = await requireActiveFarm();
  const [collection, groups] = await Promise.all([
    getEggCollection(farm.id, id),
    listBirdGroups(farm.id),
  ]);
  if (!collection) notFound();

  return (
    <div>
      <PageHeader title="Koreguoti surinkimą" backHref="/eggs/collections" />
      <div className="flex flex-col gap-6 px-4">
        <EggCollectionForm
          birdGroups={groups.map((g) => ({ id: g.id, label: g.breed.name }))}
          collectionId={collection.id}
          defaultValues={{
            collectionDate: collection.collectionDate.toISOString().slice(0, 10),
            quantity: collection.quantity,
            birdGroupId: collection.birdGroupId ?? "",
            quality: collection.quality ?? undefined,
          }}
          onSuccessPath="/eggs/collections"
        />
        <DeleteRecordButton
          endpoint={`/api/egg-collections/${collection.id}`}
          redirectTo="/eggs/collections"
          triggerLabel="Ištrinti įrašą"
          title="Ištrinti surinkimo įrašą?"
          description="Šis kiaušinių surinkimo įrašas bus visam laikui ištrintas. Šio veiksmo atšaukti nepavyks."
        />
      </div>
    </div>
  );
}
