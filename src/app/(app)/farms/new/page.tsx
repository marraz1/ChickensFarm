import { requireUser } from "@/lib/session";
import { listFarmsForUser } from "@/lib/services/farms";
import { PageHeader } from "@/components/layout/page-header";
import { FarmForm } from "@/components/forms/farm-form";

export default async function NewFarmPage() {
  const user = await requireUser();
  const farms = await listFarmsForUser(user.id);
  const hasFarms = farms.length > 0;

  return (
    <div>
      <PageHeader title="Naujas ūkis" backHref={hasFarms ? "/farms" : undefined} />
      <div className="px-4">
        <FarmForm onSuccessPath="/" />
      </div>
    </div>
  );
}
