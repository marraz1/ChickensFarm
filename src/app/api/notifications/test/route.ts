import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { notificationTestSchema } from "@/lib/validation/notifications";
import { isEmailConfigured, sendReminderEmail } from "@/lib/email";
import { pushPublicKey, reminderPayload, sendPushToUser } from "@/lib/push";

type ChannelResult = { attempted: boolean; sent: boolean; reason?: string };
type PushChannelResult = { attempted: boolean; sent: number; reason?: string };

/**
 * Sends a test notification through whichever channels the caller has on,
 * right now, ignoring the schedule entirely.
 *
 * This never touches NotificationSetting.lastRunOn, unlike a real reminder — a
 * test must never accidentally mark today as "handled" and suppress the
 * scheduled send. Takes the current form values directly rather than reading
 * the saved row, so it tests what the user is about to save, before they save it.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUserApi();
    const body = await req.json();
    const parsed = notificationTestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" },
        { status: 400 },
      );
    }
    const { message, email, emailEnabled, pushEnabled } = parsed.data;

    let emailResult: ChannelResult = { attempted: false, sent: false };
    if (emailEnabled) {
      if (!isEmailConfigured()) {
        emailResult = { attempted: true, sent: false, reason: "RESEND_API_KEY nenustatytas" };
      } else {
        const recipient = email?.trim() || user.email;
        if (!recipient) {
          emailResult = { attempted: true, sent: false, reason: "nenurodytas adresas" };
        } else {
          try {
            await sendReminderEmail(recipient, message);
            emailResult = { attempted: true, sent: true };
          } catch {
            emailResult = { attempted: true, sent: false, reason: "siuntimo klaida" };
          }
        }
      }
    }

    let pushResult: PushChannelResult = { attempted: false, sent: 0 };
    if (pushEnabled) {
      if (!pushPublicKey()) {
        pushResult = { attempted: true, sent: 0, reason: "VAPID nesukonfigūruotas" };
      } else {
        const result = await sendPushToUser(user.id, reminderPayload(message));
        pushResult =
          result.sent > 0
            ? { attempted: true, sent: result.sent }
            : {
                attempted: true,
                sent: 0,
                reason:
                  result.removed > 0
                    ? "prenumerata nebegalioja — išjunkite ir vėl įjunkite"
                    : "nerastas įrenginys",
              };
      }
    }

    return NextResponse.json({ email: emailResult, push: pushResult });
  } catch (err) {
    return handleApiError(err);
  }
}
