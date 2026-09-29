import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createBirdConsumptionSchema } from "@/lib/validation/bird-consumptions";
import { listBirdConsumptions, createBirdConsumption } from "@/lib/services/bird-consumptions";
import { NegativeQuantityError } from "@/lib/services/bird-groups";

export async function GET() {
  try {
    const { farm } = await requireActiveFarmApi();
    const consumptions = await listBirdConsumptions(farm.id);
    return NextResponse.json(consumptions);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { farm, user } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createBirdConsumptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" },
        { status: 400 },
      );
    }
    const consumption = await createBirdConsumption(farm.id, user.id, parsed.data);
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
