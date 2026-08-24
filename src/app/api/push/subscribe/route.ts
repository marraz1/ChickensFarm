import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { pushSubscriptionSchema, pushUnsubscribeSchema } from "@/lib/validation/push";
import { savePushSubscription, deletePushSubscription } from "@/lib/services/push-subscriptions";

export async function POST(req: Request) {
  try {
    const user = await requireUserApi();
    const body = await req.json();
    const parsed = pushSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" },
        { status: 400 },
      );
    }
    // Stored only to make a device recognisable in the database while debugging.
    const userAgent = req.headers.get("user-agent")?.slice(0, 255) ?? null;
    await savePushSubscription(user.id, parsed.data, userAgent);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUserApi();
    const body = await req.json();
    const parsed = pushUnsubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" },
        { status: 400 },
      );
    }
    await deletePushSubscription(user.id, parsed.data.endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
