import Link from "next/link";
import { requireActiveFarm } from "@/lib/session";
import { listExpenses } from "@/lib/services/expenses";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { formatDateLT, formatEUR } from "@/lib/format";
import { expenseCategoryLabels } from "@/lib/labels";
import { Plus } from "lucide-react";

export default async function ExpensesPage() {
  const { farm } = await requireActiveFarm();
  const expenses = await listExpenses(farm.id);

  return (
    <div>
      <PageHeader
        title="Išlaidos"
        backHref="/finance"
        action={
          <Link
            href="/expenses/new"
            className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} aria-hidden /> Nauja
          </Link>
        }
      />
      <div className="flex flex-col gap-3 px-4">
        {expenses.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Dar nėra įrašų.</p>
        )}
        {expenses.map((expense) => (
          <Link key={expense.id} href={`/expenses/${expense.id}/edit`}>
            <Card className="flex flex-row items-center justify-between p-4">
              <div>
                <p className="font-medium">
                  {expenseCategoryLabels[expense.category]} · {formatDateLT(expense.expenseDate)}
                </p>
                {expense.description && (
                  <p className="text-sm text-muted-foreground">{expense.description}</p>
                )}
              </div>
              <p className="text-lg font-semibold">{formatEUR(expense.amount)}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
