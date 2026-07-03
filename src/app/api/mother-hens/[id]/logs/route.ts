import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createMotherHenLogSchema } from "@/lib/validation/mother-hens";
import { addMotherHenLog } from "@/lib/services/mother-hens";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { farm } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createMotherHenLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const log = await addMotherHenLog(farm.id, id, parsed.data);
    return NextResponse.json(log);
  } catch (err) {
    return handleApiError(err);
  }
}
