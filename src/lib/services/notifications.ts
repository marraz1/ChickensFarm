import { prisma } from "@/lib/prisma";
import { dateOnlyUtc, getLocalNow, shouldStampToday } from "@/lib/notification-schedule";
import type { NotificationSettingInput } from "@/lib/validation/notifications";

export function getNotificationSetting(userId: string) {
  return prisma.notificationSetting.findUnique({ where: { userId } });
}

/**
 * Creates or updates the caller's settings.
 *
 * When the chosen time has already passed today, the local day is stamped as
 * handled. Without that, enabling a 08:00 reminder at 09:00 would send an email
 * on the very next cron tick — while the user is still on the settings screen.
 */
export async function saveNotificationSetting(
  userId: string,
  input: NotificationSettingInput,
  now: Date = new Date(),
) {
  const stampToday =
    input.enabled && shouldStampToday(input.sendTime, input.timeZone, now)
      ? dateOnlyUtc(getLocalNow(now, input.timeZone).date)
      : null;

  const data = {
    enabled: input.enabled,
    message: input.message,
    sendTime: input.sendTime,
    // Stored as null rather than "" so the fallback to the account email is a
    // single check everywhere downstream.
    email: input.email?.trim() || null,
    timeZone: input.timeZone,
    channel: input.channel,
    ...(stampToday ? { lastRunOn: stampToday } : {}),
  };

  return prisma.notificationSetting.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}
