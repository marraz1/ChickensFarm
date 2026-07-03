import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getEggConsumption } from "@/lib/services/egg-consumptions";
import { PageHeader } from "@/components/layout/page-header";
import { EggConsumptionForm } from "@/components/forms/egg-consumption-form";
import { DeleteRecordButton } from "@/components/forms/delete-record-button";

export default async function EditEggConsumptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { farm } = await requireActiveFarm();
  const consumption = await getEggConsumption(farm.id, id);
  if (!consumption) notFound();

  return (
    <div>
      <PageHeader title="Koreguoti įrašą" backHref="/eggs/consumptions" />
      <div className="flex flex-col gap-6 px-4">
        <EggConsumptionForm
          consumptionId={consumption.id}
          defaultValues={{
            consumptionDate: consumption.consumptionDate.toISOString().slice(0, 10),
            quantity: consumption.quantity,
            note: consumption.note ?? "",
          }}
          onSuccessPath="/eggs/consumptions"
        />
        <DeleteRecordButton
          endpoint={`/api/egg-consumptions/${consumption.id}`}
          redirectTo="/eggs/consumptions"
          triggerLabel="Ištrinti įrašą"
          title="Ištrinti suvartojimo įrašą?"
          description="Šis suvartotų kiaušinių įrašas bus visam laikui ištrintas. Šio veiksmo atšaukti nepavyks."
        />
      </div>
    </div>
  );
}
