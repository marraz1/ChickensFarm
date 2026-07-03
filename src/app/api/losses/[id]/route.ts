import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createLossSchema } from "@/lib/validation/losses";
import { updateLoss, deleteLoss } from "@/lib/services/losses";
import { NegativeQuantityError } from "@/lib/services/bird-groups";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { farm, user } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createLossSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const loss = await updateLoss(farm.id, id, user.id, parsed.data);
    return NextResponse.json(loss);
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
    await deleteLoss(farm.id, id, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
