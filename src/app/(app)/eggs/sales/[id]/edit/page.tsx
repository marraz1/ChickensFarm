import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getEggSale } from "@/lib/services/egg-sales";
import { PageHeader } from "@/components/layout/page-header";
import { EggSaleForm } from "@/components/forms/egg-sale-form";
import { DeleteRecordButton } from "@/components/forms/delete-record-button";

export default async function EditEggSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { farm } = await requireActiveFarm();
  const sale = await getEggSale(farm.id, id);
  if (!sale) notFound();

  return (
    <div>
      <PageHeader title="Koreguoti pardavimą" backHref="/eggs/sales" />
      <div className="flex flex-col gap-6 px-4">
        <EggSaleForm
          saleId={sale.id}
          defaultValues={{
            saleDate: sale.saleDate.toISOString().slice(0, 10),
            quantity: sale.quantity,
            unitPrice: Number(sale.unitPrice),
            totalAmount: Number(sale.totalAmount),
            buyer: sale.buyer ?? "",
          }}
          onSuccessPath="/eggs/sales"
        />
        <DeleteRecordButton
          endpoint={`/api/egg-sales/${sale.id}`}
          redirectTo="/eggs/sales"
          triggerLabel="Ištrinti pardavimą"
          title="Ištrinti pardavimo įrašą?"
          description="Šis kiaušinių pardavimo įrašas bus visam laikui ištrintas. Šio veiksmo atšaukti nepavyks."
        />
      </div>
    </div>
  );
}
