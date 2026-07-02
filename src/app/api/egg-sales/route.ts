import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { createEggSaleSchema } from "@/lib/validation/egg-sales";
import { listEggSales, createEggSale } from "@/lib/services/egg-sales";

export async function GET() {
  try {
    const { farm } = await requireActiveFarmApi();
    const sales = await listEggSales(farm.id);
    return NextResponse.json(sales);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { farm } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createEggSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
    }
    const sale = await createEggSale(farm.id, parsed.data);
    return NextResponse.json(sale);
  } catch (err) {
    return handleApiError(err);
  }
}
