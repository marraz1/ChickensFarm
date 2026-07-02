import { requireActiveFarm } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { EggSaleForm } from "@/components/forms/egg-sale-form";

export default async function NewEggSalePage() {
  await requireActiveFarm();

  return (
    <div>
      <PageHeader title="Naujas pardavimas" backHref="/eggs/sales" />
      <div className="px-4">
        <EggSaleForm />
      </div>
    </div>
  );
}
