import { requireActiveFarm } from "@/lib/session";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { BirdTransactionForm } from "@/components/forms/bird-transaction-form";
import { birdTransactionPages } from "@/components/bird-transaction-list";
import { birdGroupOptions } from "@/lib/bird-group-options";
import { groupAreaFromParam, groupAreaSlug } from "@/lib/v2-navigation";

export default async function NewBirdPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string | string[] }>;
}) {
  // "Pirkti paukščių" / Mėsa's "Pirkti jauniklių auginti" add ?area= so only
  // that area's groups are offered (#186).
  const area = groupAreaFromParam((await searchParams).area);
  const { farm } = await requireActiveFarm();
  const groups = await listBirdGroups(farm.id, area);
  // Back to the list in the same area, so the bar keeps it lit after saving.
  const listPath = (basePath: string) =>
    area ? `${basePath}?area=${groupAreaSlug(area)}` : basePath;
  const page = birdTransactionPages.PURCHASE;

  return (
    <div>
      <PageHeader title={page.newTitle} backHref={listPath(page.basePath)} />
      <div className="px-4">
        <BirdTransactionForm
          type="PURCHASE"
          birdGroups={birdGroupOptions(groups)}
          onSuccessPath={listPath(page.basePath)}
        />
      </div>
    </div>
  );
}
