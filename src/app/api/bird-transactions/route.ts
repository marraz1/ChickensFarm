import { NextResponse } from "next/server";
import { requireActiveFarmApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import {
  birdTransactionTypeEnum,
  createBirdTransactionSchema,
} from "@/lib/validation/bird-transactions";
import { listBirdTransactions, createBirdTransaction } from "@/lib/services/bird-transactions";
import { NegativeQuantityError } from "@/lib/services/bird-groups";

export async function GET(req: Request) {
  try {
    const { farm } = await requireActiveFarmApi();
    // ?type=SALE|PURCHASE narrows the list; anything else lists both directions.
    const typeParam = new URL(req.url).searchParams.get("type");
    const parsedType = birdTransactionTypeEnum.safeParse(typeParam);
    const transactions = await listBirdTransactions(
      farm.id,
      parsedType.success ? parsedType.data : undefined,
    );
    return NextResponse.json(transactions);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { farm, user } = await requireActiveFarmApi();
    const body = await req.json();
    const parsed = createBirdTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" },
        { status: 400 },
      );
    }
    const transaction = await createBirdTransaction(farm.id, user.id, parsed.data);
    return NextResponse.json(transaction);
  } catch (err) {
    if (err instanceof NegativeQuantityError) {
      return NextResponse.json(
        { error: "Parduodamų paukščių kiekis viršija grupėje esantį skaičių" },
        { status: 400 },
      );
    }
    return handleApiError(err);
  }
}
