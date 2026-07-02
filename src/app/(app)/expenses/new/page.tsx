import { requireActiveFarm } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { ExpenseForm } from "@/components/forms/expense-form";

export default async function NewExpensePage() {
  await requireActiveFarm();

  return (
    <div>
      <PageHeader title="Nauja išlaida" backHref="/expenses" />
      <div className="px-4">
        <ExpenseForm />
      </div>
    </div>
  );
}
