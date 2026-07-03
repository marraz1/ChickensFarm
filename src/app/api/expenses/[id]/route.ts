import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createExpenseSchema } from "@/lib/validation/expenses";
import { updateExpense, deleteExpense } from "@/lib/services/expenses";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { farm } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const expense = await updateExpense(farm.id, id, parsed.data);
    return NextResponse.json(expense);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { farm } = await requireActiveFarmApi();
    await deleteExpense(farm.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
