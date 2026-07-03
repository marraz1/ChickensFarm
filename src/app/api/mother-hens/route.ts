import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createMotherHenSchema } from "@/lib/validation/mother-hens";
import { listMotherHens, createMotherHen } from "@/lib/services/mother-hens";

export async function GET() {
  try {
    const { farm } = await requireActiveFarmApi();
    const hens = await listMotherHens(farm.id);
    return NextResponse.json(hens);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { farm } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createMotherHenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const hen = await createMotherHen(farm.id, parsed.data);
    return NextResponse.json(hen);
  } catch (err) {
    return handleApiError(err);
  }
}
