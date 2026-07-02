import { NextResponse } from "next/server";
import { requireFarmAccessApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { updateFarmSchema } from "@/lib/validation/farms";
import { updateFarm, softDeleteFarm } from "@/lib/services/farms";

export async function GET(_req: Request, { params }: { params: Promise<{ farmId: string }> }) {
  try {
    const { farmId } = await params;
    const { farm } = await requireFarmAccessApi(farmId);
    return NextResponse.json(farm);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ farmId: string }> }) {
  try {
    const { farmId } = await params;
    await requireFarmAccessApi(farmId, { minRole: "OWNER" });
    const body = await req.json();
    const parsed = updateFarmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const farm = await updateFarm(farmId, parsed.data);
    return NextResponse.json(farm);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ farmId: string }> }) {
  try {
    const { farmId } = await params;
    await requireFarmAccessApi(farmId, { minRole: "OWNER" });
    await softDeleteFarm(farmId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
