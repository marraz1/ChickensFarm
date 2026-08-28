import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createBirdTransactionSchema } from "@/lib/validation/bird-transactions";
import { updateBirdTransaction, deleteBirdTransaction } from "@/lib/services/bird-transactions";
import { NegativeQuantityError } from "@/lib/services/bird-groups";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { farm, user } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createBirdTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" },
        { status: 400 },
      );
    }
    const transaction = await updateBirdTransaction(farm.id, id, user.id, parsed.data);
    return NextResponse.json(transaction);
  } catch (err) {
    if (err instanceof NegativeQuantityError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { farm, user } = await requireActiveFarmApi();
    await deleteBirdTransaction(farm.id, id, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NegativeQuantityError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return handleApiError(err);
  }
}
