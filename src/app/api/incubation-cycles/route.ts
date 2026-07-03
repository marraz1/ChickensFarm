import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createIncubationCycleSchema } from "@/lib/validation/incubation";
import { listIncubationCycles, createIncubationCycle } from "@/lib/services/incubation";

export async function GET() {
  try {
    const { farm } = await requireActiveFarmApi();
    const cycles = await listIncubationCycles(farm.id);
    return NextResponse.json(cycles);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { farm } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createIncubationCycleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const cycle = await createIncubationCycle(farm.id, parsed.data);
    return NextResponse.json(cycle);
  } catch (err) {
    return handleApiError(err);
  }
}
