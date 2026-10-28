import { requireActiveFarm } from "@/lib/session";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { BirdTransactionForm } from "@/components/forms/bird-transaction-form";
import { birdTransactionPages } from "@/components/bird-transaction-list";
import { birdGroupOptions } from "@/lib/bird-group-options";
import { groupAreaFromParam } from "@/lib/v2-navigation";

export default async function NewBirdSalePage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string | string[] }>;
}) {
  // "Parduoti paukščių" from an area adds ?area= so only its groups are offered (#186).
  const area = groupAreaFromParam((await searchParams).area);
  const { farm } = await requireActiveFarm();
  const groups = await listBirdGroups(farm.id, area);
  const page = birdTransactionPages.SALE;

  return (
    <div>
      <PageHeader title={page.newTitle} backHref={page.basePath} />
      <div className="px-4">
        <BirdTransactionForm
          type="SALE"
          birdGroups={birdGroupOptions(groups)}
          onSuccessPath={page.basePath}
        />
      </div>
    </div>
  );
}
