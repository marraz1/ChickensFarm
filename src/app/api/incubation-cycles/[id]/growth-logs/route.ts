import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createGrowthLogSchema } from "@/lib/validation/incubation";
import { addGrowthLog } from "@/lib/services/incubation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { farm } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createGrowthLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const log = await addGrowthLog(farm.id, id, parsed.data);
    return NextResponse.json(log);
  } catch (err) {
    return handleApiError(err);
  }
}
