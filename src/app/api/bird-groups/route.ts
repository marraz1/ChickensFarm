import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createBirdGroupSchema } from "@/lib/validation/bird-groups";
import { listBirdGroups, createBirdGroup } from "@/lib/services/bird-groups";

export async function GET() {
  try {
    const { farm } = await requireActiveFarmApi();
    const groups = await listBirdGroups(farm.id);
    return NextResponse.json(groups);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { farm, user } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createBirdGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const group = await createBirdGroup(farm.id, user.id, parsed.data);
    return NextResponse.json(group);
  } catch (err) {
    return handleApiError(err);
  }
}
