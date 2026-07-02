import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createExpenseSchema } from "@/lib/validation/expenses";
import { listExpenses, createExpense } from "@/lib/services/expenses";

export async function GET() {
  try {
    const { farm } = await requireActiveFarmApi();
    const expenses = await listExpenses(farm.id);
    return NextResponse.json(expenses);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { farm } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const expense = await createExpense(farm.id, parsed.data);
    return NextResponse.json(expense);
  } catch (err) {
    return handleApiError(err);
  }
}
