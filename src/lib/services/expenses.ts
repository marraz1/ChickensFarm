import { prisma } from "@/lib/prisma";
import type { CreateExpenseInput } from "@/lib/validation/expenses";
import type { ExpenseCategory } from "@/generated/prisma/client";

export function listExpenses(farmId: string) {
  return prisma.expense.findMany({
    where: { farmId },
    orderBy: { expenseDate: "desc" },
  });
}

export function createExpense(farmId: string, input: CreateExpenseInput) {
  return prisma.expense.create({
    data: {
      farmId,
      expenseDate: new Date(input.expenseDate),
      category: input.category,
      amount: input.amount,
      description: input.description || null,
    },
  });
}

export async function getExpensesByCategoryReport(farmId: string, range: { from: Date; to: Date }) {
  const grouped = await prisma.expense.groupBy({
    by: ["category"],
    where: { farmId, expenseDate: { gte: range.from, lte: range.to } },
    _sum: { amount: true },
  });

  const totals: Record<ExpenseCategory, number> = {
    FEED: 0,
    VITAMINS: 0,
    MEDICINE: 0,
    PRODUCTIVITY: 0,
    OTHER: 0,
  };
  for (const row of grouped) {
    totals[row.category] = Number(row._sum.amount ?? 0);
  }
  return totals;
}
