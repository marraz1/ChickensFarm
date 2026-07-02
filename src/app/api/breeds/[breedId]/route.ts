import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { updateBreedSchema } from "@/lib/validation/breeds";
import { updateBreed, deleteBreed } from "@/lib/services/breeds";

export async function PATCH(req: Request, { params }: { params: Promise<{ breedId: string }> }) {
  try {
    const { breedId } = await params;
    const { farm } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = updateBreedSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    await updateBreed(farm.id, breedId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ breedId: string }> }) {
  try {
    const { breedId } = await params;
    const { farm } = await requireActiveFarmApi();
    await deleteBreed(farm.id, breedId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
