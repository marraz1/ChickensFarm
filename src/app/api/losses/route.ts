import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createLossSchema } from "@/lib/validation/losses";
import { listLosses, createLoss } from "@/lib/services/losses";
import { NegativeQuantityError } from "@/lib/services/bird-groups";

export async function GET() {
  try {
    const { farm } = await requireActiveFarmApi();
    const losses = await listLosses(farm.id);
    return NextResponse.json(losses);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { farm, user } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createLossSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const loss = await createLoss(farm.id, user.id, parsed.data);
    return NextResponse.json(loss);
  } catch (err) {
    if (err instanceof NegativeQuantityError) {
      return NextResponse.json(
        { error: "Nuostolio kiekis viršija grupėje esantį paukščių skaičių" },
        { status: 400 }
      );
    }
    return handleApiError(err);
  }
}
