import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createEggConsumptionSchema } from "@/lib/validation/egg-consumptions";
import { listEggConsumptions, createEggConsumption } from "@/lib/services/egg-consumptions";

export async function GET() {
  try {
    const { farm } = await requireActiveFarmApi();
    const consumptions = await listEggConsumptions(farm.id);
    return NextResponse.json(consumptions);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { farm } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createEggConsumptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const consumption = await createEggConsumption(farm.id, parsed.data);
    return NextResponse.json(consumption);
  } catch (err) {
    return handleApiError(err);
  }
}
