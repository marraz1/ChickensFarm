import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { notificationTestSchema } from "@/lib/validation/notifications";
import { isEmailConfigured, sendReminderEmail } from "@/lib/email";
import { pushPublicKey, reminderPayload, sendPushToUser } from "@/lib/push";

type ChannelResult = {
  attempted: boolean;
  sent: boolean;
  reason?: string;
  /** Echoed back so the user can see WHERE it tried to send — the usual cause of
   *  a rejection is the address, not the configuration. */
  to?: string;
};
type PushChannelResult = { attempted: boolean; sent: number; reason?: string };

/**
 * The provider's own words, trimmed to something a person can read in a toast.
 *
 * Worth surfacing rather than flattening to "send failed": Resend's free tier
 * refuses any recipient other than the account owner while the sender is
 * onboarding@resend.dev, and its message names both the restriction and the
 * allowed address — which is the entire diagnosis, and unguessable without it.
 */
function describeSendError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const cleaned = raw.replace(/^Resend failed:\s*/, "").trim();
  if (!cleaned) return "siuntimo klaida";
  return cleaned.length > 200 ? `${cleaned.slice(0, 199)}…` : cleaned;
}

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
            emailResult = { attempted: true, sent: true, to: recipient };
          } catch (err) {
            console.error("[notifications/test] email failed", { to: recipient, err });
            emailResult = {
              attempted: true,
              sent: false,
              reason: describeSendError(err),
              to: recipient,
            };
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
