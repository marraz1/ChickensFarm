import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { updateIncubationCycleSchema } from "@/lib/validation/incubation";
import { recordCandling, finalizeHatch } from "@/lib/services/incubation";
import { NegativeQuantityError } from "@/lib/services/bird-groups";

// Records either candling results or the hatch, selected by the body's `action` field.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { farm, user } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = updateIncubationCycleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }

    const result =
      parsed.data.action === "candling"
        ? await recordCandling(farm.id, id, parsed.data)
        : await finalizeHatch(farm.id, id, user.id, parsed.data);

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NegativeQuantityError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return handleApiError(err);
  }
}
