import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getBirdGroupWithEvents } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { AdjustBirdGroupForm } from "@/components/forms/adjust-bird-group-form";

export default async function EditBirdGroupPage({
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
      <PageHeader title="Koreguoti grupę" backHref={`/bird-groups/${group.id}`} />
      <div className="px-4">
        <AdjustBirdGroupForm
          groupId={group.id}
          currentQuantity={group.quantity}
          currentCategory={group.category}
        />
      </div>
    </div>
  );
}
