import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { adjustBirdGroupSchema } from "@/lib/validation/bird-groups";
import { manualAdjustBirdGroup, NegativeQuantityError } from "@/lib/services/bird-groups";

export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params;
    const { farm, user } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = adjustBirdGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }

    const group = await manualAdjustBirdGroup(farm.id, groupId, user.id, parsed.data);
    return NextResponse.json(group);
  } catch (err) {
    if (err instanceof NegativeQuantityError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return handleApiError(err);
  }
}
