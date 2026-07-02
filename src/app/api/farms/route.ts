import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createFarmSchema } from "@/lib/validation/farms";
import { listFarmsForUser, createFarm } from "@/lib/services/farms";

export async function GET() {
  try {
    const user = await requireUserApi();
    const farms = await listFarmsForUser(user.id);
    return NextResponse.json(farms);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUserApi();
    const body = await req.json();
    const parsed = createFarmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }

    const farm = await createFarm(user.id, parsed.data);
    return NextResponse.json(farm);
  } catch (err) {
    return handleApiError(err);
  }
}
