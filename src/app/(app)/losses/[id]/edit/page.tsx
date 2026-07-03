import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getLoss } from "@/lib/services/losses";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { LossForm } from "@/components/forms/loss-form";
import { DeleteRecordButton } from "@/components/forms/delete-record-button";

export default async function EditLossPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { farm } = await requireActiveFarm();
  const [loss, groups] = await Promise.all([getLoss(farm.id, id), listBirdGroups(farm.id)]);
  if (!loss) notFound();

  return (
    <div>
      <PageHeader title="Koreguoti nuostolį" backHref="/losses" />
      <div className="flex flex-col gap-6 px-4">
        <LossForm
          birdGroups={groups.map((g) => ({ id: g.id, label: g.breed.name }))}
          lossId={loss.id}
          defaultValues={{
            lossDate: loss.lossDate.toISOString().slice(0, 10),
            quantity: loss.quantity,
            reasonType: loss.reasonType,
            birdGroupId: loss.birdGroupId ?? "",
            comment: loss.comment ?? "",
          }}
          onSuccessPath="/losses"
        />
        <DeleteRecordButton
          endpoint={`/api/losses/${loss.id}`}
          redirectTo="/losses"
          triggerLabel="Ištrinti nuostolį"
          title="Ištrinti nuostolio įrašą?"
          description="Įrašas bus ištrintas, o jei buvo nurodyta paukščių grupė — jos kiekis bus atstatytas. Šio veiksmo atšaukti nepavyks."
        />
      </div>
    </div>
  );
}
