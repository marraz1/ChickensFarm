import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createEggCollectionSchema } from "@/lib/validation/egg-collections";
import { listEggCollections, createEggCollection } from "@/lib/services/egg-collections";

export async function GET() {
  try {
    const { farm } = await requireActiveFarmApi();
    const collections = await listEggCollections(farm.id);
    return NextResponse.json(collections);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { farm } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createEggCollectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const collection = await createEggCollection(farm.id, parsed.data);
    return NextResponse.json(collection);
  } catch (err) {
    return handleApiError(err);
  }
}
