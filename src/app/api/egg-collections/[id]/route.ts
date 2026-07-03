import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createEggCollectionSchema } from "@/lib/validation/egg-collections";
import { updateEggCollection, deleteEggCollection } from "@/lib/services/egg-collections";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { farm } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createEggCollectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const collection = await updateEggCollection(farm.id, id, parsed.data);
    return NextResponse.json(collection);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { farm } = await requireActiveFarmApi();
    await deleteEggCollection(farm.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
