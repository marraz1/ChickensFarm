import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createEggSaleSchema } from "@/lib/validation/egg-sales";
import { updateEggSale, deleteEggSale } from "@/lib/services/egg-sales";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { farm } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createEggSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const sale = await updateEggSale(farm.id, id, parsed.data);
    return NextResponse.json(sale);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { farm } = await requireActiveFarmApi();
    await deleteEggSale(farm.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
