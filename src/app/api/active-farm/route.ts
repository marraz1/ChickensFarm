import { NextResponse } from "next/server";
import { requireFarmAccessApi, setActiveFarmId } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { z } from "zod";

const bodySchema = z.object({ farmId: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Neteisingi duomenys" }, { status: 400 });
    }
    // Ensures the requesting user actually belongs to this farm before switching to it.
    await requireFarmAccessApi(parsed.data.farmId);
    await setActiveFarmId(parsed.data.farmId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
