import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createBirdConsumptionSchema } from "@/lib/validation/bird-consumptions";
import { updateBirdConsumption, deleteBirdConsumption } from "@/lib/services/bird-consumptions";
import { NegativeQuantityError } from "@/lib/services/bird-groups";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { farm, user } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createBirdConsumptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" },
        { status: 400 },
      );
    }
    const consumption = await updateBirdConsumption(farm.id, id, user.id, parsed.data);
    return NextResponse.json(consumption);
  } catch (err) {
    if (err instanceof NegativeQuantityError) {
      return NextResponse.json(
        { error: "Kiekis viršija grupėje esantį paukščių skaičių" },
        { status: 400 },
      );
    }
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { farm, user } = await requireActiveFarmApi();
    await deleteBirdConsumption(farm.id, id, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
