import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getExpense } from "@/lib/services/expenses";
import { PageHeader } from "@/components/layout/page-header";
import { ExpenseForm } from "@/components/forms/expense-form";
import { DeleteRecordButton } from "@/components/forms/delete-record-button";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { farm } = await requireActiveFarm();
  const expense = await getExpense(farm.id, id);
  if (!expense) notFound();

  return (
    <div>
      <PageHeader title="Koreguoti išlaidą" backHref="/expenses" />
      <div className="flex flex-col gap-6 px-4">
        <ExpenseForm
          expenseId={expense.id}
          defaultValues={{
            expenseDate: expense.expenseDate.toISOString().slice(0, 10),
            category: expense.category,
            amount: Number(expense.amount),
            description: expense.description ?? "",
          }}
          onSuccessPath="/expenses"
        />
        <DeleteRecordButton
          endpoint={`/api/expenses/${expense.id}`}
          redirectTo="/expenses"
          triggerLabel="Ištrinti išlaidą"
          title="Ištrinti išlaidos įrašą?"
          description="Šis išlaidos įrašas bus visam laikui ištrintas. Šio veiksmo atšaukti nepavyks."
        />
      </div>
    </div>
  );
}
