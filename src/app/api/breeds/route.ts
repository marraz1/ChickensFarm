import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createBreedSchema } from "@/lib/validation/breeds";
import { listBreeds, createBreed } from "@/lib/services/breeds";

export async function GET() {
  try {
    const { farm } = await requireActiveFarmApi();
    const breeds = await listBreeds(farm.id);
    return NextResponse.json(breeds);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { farm } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createBreedSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const breed = await createBreed(farm.id, parsed.data);
    return NextResponse.json(breed);
  } catch (err) {
    return handleApiError(err);
  }
}
