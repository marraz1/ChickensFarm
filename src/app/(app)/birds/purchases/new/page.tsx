import { requireActiveFarm } from "@/lib/session";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { BirdTransactionForm } from "@/components/forms/bird-transaction-form";
import { birdTransactionPages } from "@/components/bird-transaction-list";

export default async function NewBirdPurchasePage() {
  const { farm } = await requireActiveFarm();
  const groups = await listBirdGroups(farm.id);
  const page = birdTransactionPages.PURCHASE;

  return (
    <div>
      <PageHeader title={page.newTitle} backHref={page.basePath} />
      <div className="px-4">
        <BirdTransactionForm
          type="PURCHASE"
          birdGroups={groups.map((g) => ({ id: g.id, label: g.breed.name }))}
          onSuccessPath={page.basePath}
        />
      </div>
    </div>
  );
}
