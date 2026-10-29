import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getExpense } from "@/lib/services/expenses";
import { expenseTargetLabel } from "@/lib/services/area-targets";
import { PageHeader } from "@/components/layout/page-header";
import { ExpenseForm } from "@/components/forms/expense-form";
import { DeleteRecordButton } from "@/components/forms/delete-record-button";
import { isAreaSlug } from "@/lib/v2-navigation";

export default async function EditExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ area?: string | string[] }>;
}) {
  const { id } = await params;
  const { area } = await searchParams;
  const { farm } = await requireActiveFarm();
  const expense = await getExpense(farm.id, id);
  if (!expense) notFound();

  // Opened from an area's Išlaidos tab (#194): back, save and delete return
  // there. Otherwise the farm-wide list, as before.
  const fromArea = typeof area === "string" && isAreaSlug(area);
  const returnPath = fromArea ? `/areas/${area}/expenses` : "/expenses";

  return (
    <div>
      <PageHeader title="Koreguoti išlaidą" backHref={returnPath} />
      <div className="flex flex-col gap-6 px-4">
        <ExpenseForm
          expenseId={expense.id}
          defaultValues={{
            expenseDate: expense.expenseDate.toISOString().slice(0, 10),
            category: expense.category,
            amount: Number(expense.amount),
            description: expense.description ?? "",
            // Shown under "Sritis", so the expense can be moved (#193).
            area: expense.area,
          }}
          onSuccessPath={returnPath}
          // Moved to another area, it is no longer on this area's tab: saving
          // opens the new area's tab instead.
          followMovedArea={fromArea}
          targetLabel={await expenseTargetLabel(farm.id, expense)}
        />
        <DeleteRecordButton
          endpoint={`/api/expenses/${expense.id}`}
          redirectTo={returnPath}
          triggerLabel="Ištrinti išlaidą"
          title="Ištrinti išlaidos įrašą?"
          description="Šis išlaidos įrašas bus visam laikui ištrintas. Šio veiksmo atšaukti nepavyks."
        />
      </div>
    </div>
  );
}
