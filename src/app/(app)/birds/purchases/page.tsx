import Link from "next/link";
import { requireActiveFarm } from "@/lib/session";
import { listBirdTransactions } from "@/lib/services/bird-transactions";
import { PageHeader } from "@/components/layout/page-header";
import { BirdTransactionList, birdTransactionPages } from "@/components/bird-transaction-list";
import { Plus } from "lucide-react";

export default async function BirdPurchasesPage() {
  const { farm } = await requireActiveFarm();
  const transactions = await listBirdTransactions(farm.id, "PURCHASE");
  const page = birdTransactionPages.PURCHASE;

  return (
    <div>
      <PageHeader
        title={page.listTitle}
        backHref="/finance"
        action={
          <Link
            href={`${page.basePath}/new`}
            className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} aria-hidden /> Naujas
          </Link>
        }
      />
      <BirdTransactionList transactions={transactions} type="PURCHASE" />
    </div>
  );
}
