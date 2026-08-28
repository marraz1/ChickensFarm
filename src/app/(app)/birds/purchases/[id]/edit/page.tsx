import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getBirdTransaction } from "@/lib/services/bird-transactions";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { BirdTransactionForm } from "@/components/forms/bird-transaction-form";
import { DeleteRecordButton } from "@/components/forms/delete-record-button";
import { birdTransactionPages } from "@/components/bird-transaction-list";

export default async function EditBirdPurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { farm } = await requireActiveFarm();
  const [transaction, groups] = await Promise.all([
    getBirdTransaction(farm.id, id),
    listBirdGroups(farm.id),
  ]);
  // A sale id under the purchases route is as much a wrong address as a missing
  // record — the form would silently rewrite its direction on save.
  if (!transaction || transaction.type !== "PURCHASE") notFound();
  const page = birdTransactionPages.PURCHASE;

  return (
    <div>
      <PageHeader title={page.editTitle} backHref={page.basePath} />
      <div className="flex flex-col gap-6 px-4">
        <BirdTransactionForm
          type="PURCHASE"
          birdGroups={groups.map((g) => ({ id: g.id, label: g.breed.name }))}
          transactionId={transaction.id}
          defaultValues={{
            transactionDate: transaction.transactionDate.toISOString().slice(0, 10),
            quantity: transaction.quantity,
            unitPrice: Number(transaction.unitPrice),
            totalAmount: Number(transaction.totalAmount),
            birdGroupId: transaction.birdGroupId ?? "",
            counterparty: transaction.counterparty ?? "",
            note: transaction.note ?? "",
          }}
          onSuccessPath={page.basePath}
        />
        <DeleteRecordButton
          endpoint={`/api/bird-transactions/${transaction.id}`}
          redirectTo={page.basePath}
          triggerLabel={page.deleteTriggerLabel}
          title={page.deleteTitle}
          description={page.deleteDescription}
        />
      </div>
    </div>
  );
}
