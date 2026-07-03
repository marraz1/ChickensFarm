import { requireActiveFarm } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { EggConsumptionForm } from "@/components/forms/egg-consumption-form";

export default async function NewEggConsumptionPage() {
  await requireActiveFarm();

  return (
    <div>
      <PageHeader title="Suvartoti kiaušinius" backHref="/eggs/consumptions" />
      <div className="px-4">
        <EggConsumptionForm />
      </div>
    </div>
  );
}
