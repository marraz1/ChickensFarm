import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/errors";
import {
  assertTargetInArea,
  resolveTargetArea,
  sameTarget,
  targetFromInput,
} from "@/lib/services/farm-areas";
import type { CreateExpenseInput } from "@/lib/validation/expenses";
import type { ExpenseCategory } from "@/generated/prisma/client";

export function listExpenses(farmId: string) {
  return prisma.expense.findMany({
    where: { farmId },
    orderBy: { expenseDate: "desc" },
  });
}

export function getExpense(farmId: string, id: string) {
  return prisma.expense.findFirst({ where: { id, farmId } });
}

// Every expense stores exactly one area (finance rule 1). Left out, the area is
// taken from the target, else "Bendra". A target must sit in the expense's own
// area and belong to this farm; the check and the write share a transaction.
export async function createExpense(farmId: string, input: CreateExpenseInput) {
  const target = targetFromInput(input);
  return prisma.$transaction(async (tx) => {
    const targetArea = await resolveTargetArea(tx, farmId, target);
    const area = input.area ?? targetArea ?? "SHARED";
    assertTargetInArea(area, targetArea);

    return tx.expense.create({
      data: {
        farmId,
        area,
        ...target,
        expenseDate: new Date(input.expenseDate),
        category: input.category,
        amount: input.amount,
        description: input.description || null,
      },
    });
  });
}

export async function updateExpense(farmId: string, id: string, input: CreateExpenseInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findFirst({ where: { id, farmId } });
    if (!existing) throw new ValidationError("Išlaidos įrašas nerastas");

    const target = targetFromInput(input, existing);
    const targetChanged = !sameTarget(target, existing);
    let area = input.area ?? existing.area;

    // Re-check only when the area or the target changes. A group may since have
    // moved to another area (chicks grown into layers), and that must not lock
    // its older expenses against editing an amount or a date.
    if (targetChanged || area !== existing.area) {
      const targetArea = await resolveTargetArea(tx, farmId, target);
      // No area sent with a new target: follow it, as create does — and a
      // cleared target falls back to "Bendra" rather than keeping the area of
      // a target the expense no longer has.
      if (!input.area && targetChanged) area = targetArea ?? "SHARED";
      assertTargetInArea(area, targetArea);
    }

    return tx.expense.update({
      where: { id },
      data: {
        area,
        ...target,
        expenseDate: new Date(input.expenseDate),
        category: input.category,
        amount: input.amount,
        description: input.description || null,
      },
    });
  });
}

export async function deleteExpense(farmId: string, id: string) {
  const existing = await prisma.expense.findFirst({ where: { id, farmId } });
  if (!existing) throw new ValidationError("Išlaidos įrašas nerastas");
  await prisma.expense.delete({ where: { id } });
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
