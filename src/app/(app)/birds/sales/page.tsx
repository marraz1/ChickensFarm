import Link from "next/link";
import { requireActiveFarm } from "@/lib/session";
import { listBirdTransactions } from "@/lib/services/bird-transactions";
import { PageHeader } from "@/components/layout/page-header";
import { BirdTransactionList, birdTransactionPages } from "@/components/bird-transaction-list";
import { Plus } from "lucide-react";
import { groupAreaFromParam, groupAreaSlug } from "@/lib/v2-navigation";

export default async function BirdSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string | string[] }>;
}) {
  // From an area's overview (?area=): only the sales filed under that area,
  // the ones its sales figure counts (#190).
  const area = groupAreaFromParam((await searchParams).area);
  const { farm } = await requireActiveFarm();
  const transactions = await listBirdTransactions(farm.id, "SALE", area);
  const page = birdTransactionPages.SALE;
  const query = area ? `?area=${groupAreaSlug(area)}` : "";

  return (
    <div>
      <PageHeader
        title={area === "MEAT" ? "Mėsinių pardavimai" : page.listTitle}
        backHref={area ? `/areas/${groupAreaSlug(area)}` : "/finance"}
        action={
          <Link
            href={`${page.basePath}/new${query}`}
            className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} aria-hidden /> Naujas
          </Link>
        }
      />
      <BirdTransactionList transactions={transactions} type="SALE" />
    </div>
  );
}
