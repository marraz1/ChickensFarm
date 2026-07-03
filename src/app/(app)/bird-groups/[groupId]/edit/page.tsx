import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getBirdGroupWithEvents, listBirdGroups } from "@/lib/services/bird-groups";
import { listBreeds } from "@/lib/services/breeds";
import { PageHeader } from "@/components/layout/page-header";
import { BirdGroupForm } from "@/components/forms/bird-group-form";
import { DeleteBirdGroupButton } from "@/components/forms/delete-bird-group-button";

export default async function EditBirdGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const { farm } = await requireActiveFarm();
  const [group, breeds, groups] = await Promise.all([
    getBirdGroupWithEvents(farm.id, groupId),
    listBreeds(farm.id),
    listBirdGroups(farm.id),
  ]);
  if (!group) notFound();

  return (
    <div>
      <PageHeader title="Koreguoti grupę" backHref={`/bird-groups/${group.id}`} />
      <div className="flex flex-col gap-6 px-4">
        <BirdGroupForm
          breeds={breeds}
          existingGroups={groups.map((g) => ({ id: g.id, breedId: g.breedId, sex: g.sex, category: g.category }))}
          groupId={group.id}
          defaultValues={{
            breedId: group.breedId,
            name: group.name ?? "",
            sex: group.sex,
            category: group.category,
            quantity: group.quantity,
            birthOrAcquiredDate: group.birthOrAcquiredDate.toISOString().slice(0, 10),
            notes: group.notes ?? "",
          }}
          onSuccessPath={`/bird-groups/${group.id}`}
        />
        <DeleteBirdGroupButton groupId={group.id} />
      </div>
    </div>
  );
}
