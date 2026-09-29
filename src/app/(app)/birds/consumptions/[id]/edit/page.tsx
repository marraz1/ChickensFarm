import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getBirdConsumption } from "@/lib/services/bird-consumptions";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { BirdConsumptionForm } from "@/components/forms/bird-consumption-form";
import { DeleteRecordButton } from "@/components/forms/delete-record-button";
import { birdGroupOptions } from "@/lib/bird-group-options";

export default async function EditBirdConsumptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { farm } = await requireActiveFarm();
  const [consumption, groups] = await Promise.all([
    getBirdConsumption(farm.id, id),
    listBirdGroups(farm.id),
  ]);
  if (!consumption) notFound();

  return (
    <div>
      <PageHeader title="Koreguoti įrašą" backHref="/birds/consumptions" />
      <div className="flex flex-col gap-6 px-4">
        <BirdConsumptionForm
          birdGroups={birdGroupOptions(groups)}
          consumptionId={consumption.id}
          defaultValues={{
            consumptionDate: consumption.consumptionDate.toISOString().slice(0, 10),
            birdGroupId: consumption.birdGroupId,
            quantity: consumption.quantity,
            note: consumption.note ?? "",
          }}
          onSuccessPath="/birds/consumptions"
        />
        <DeleteRecordButton
          endpoint={`/api/bird-consumptions/${consumption.id}`}
          redirectTo="/birds/consumptions"
          triggerLabel="Ištrinti įrašą"
          title="Ištrinti mėsai suvartotų paukščių įrašą?"
          description="Įrašas bus ištrintas, o paukščių grupės kiekis atstatytas. Šio veiksmo atšaukti nepavyks."
        />
      </div>
    </div>
  );
}
