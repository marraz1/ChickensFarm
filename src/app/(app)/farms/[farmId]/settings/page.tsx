import { requireFarmAccess } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { FarmForm } from "@/components/forms/farm-form";
import { DeleteFarmButton } from "@/components/forms/delete-farm-button";

export default async function FarmSettingsPage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;
  const { farm } = await requireFarmAccess(farmId, { minRole: "OWNER" });

  return (
    <div>
      <PageHeader title="Ūkio nustatymai" backHref="/farms" />
      <div className="flex flex-col gap-8 px-4">
        <FarmForm
          farmId={farm.id}
          defaultValues={{ name: farm.name, location: farm.location ?? "" }}
          onSuccessPath="/farms"
        />
        <div className="border-t pt-6">
          <DeleteFarmButton farmId={farm.id} />
        </div>
      </div>
    </div>
  );
}
