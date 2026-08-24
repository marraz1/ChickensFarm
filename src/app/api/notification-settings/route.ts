import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { notificationSettingSchema } from "@/lib/validation/notifications";
import { getNotificationSetting, saveNotificationSetting } from "@/lib/services/notifications";

export async function GET() {
  try {
    const user = await requireUserApi();
    return NextResponse.json(await getNotificationSetting(user.id));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUserApi();
    const body = await req.json();
    const parsed = notificationSettingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" },
        { status: 400 },
      );
    }
    return NextResponse.json(await saveNotificationSetting(user.id, parsed.data));
  } catch (err) {
    return handleApiError(err);
  }
}
