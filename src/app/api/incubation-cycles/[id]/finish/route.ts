import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { finishGrowthTrackingSchema } from "@/lib/validation/incubation";
import { finishGrowthTracking } from "@/lib/services/incubation";
import { NegativeQuantityError } from "@/lib/services/bird-groups";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { farm, user } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = finishGrowthTrackingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const cycle = await finishGrowthTracking(farm.id, id, user.id, parsed.data);
    return NextResponse.json(cycle);
  } catch (err) {
    if (err instanceof NegativeQuantityError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return handleApiError(err);
  }
}
