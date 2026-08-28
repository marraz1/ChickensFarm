import { prisma } from "@/lib/prisma";
import {
  dateOnlyUtc,
  evaluateDue,
  getLocalNow,
  nextSendAt,
  safeTimeZone,
  shouldStampToday,
} from "@/lib/notification-schedule";
import { loadDataPresence } from "@/lib/services/data-presence";
import type { NotificationSettingInput } from "@/lib/validation/notifications";

export function getNotificationSetting(userId: string) {
  return prisma.notificationSetting.findUnique({ where: { userId } });
}

/**
 * Creates or updates the caller's settings.
 *
 * Switching reminders ON when the chosen time has already passed today stamps
 * the local day as handled, so enabling a 08:00 reminder at 09:00 does not fire
 * an email on the very next cron tick, while the user is still on this screen.
 *
 * That stamp fires ONLY on the off→on transition. Applying it to every save was
 * a bug that suppressed the reminder indefinitely: each visit to the settings
 * screen after the send time re-stamped the day, so a user who checked their
 * settings in the evening — exactly what someone does when reminders seem
 * broken — could never receive one. The cron ran fine and reported due:0 every
 * time, which made it look like a scheduling failure instead.
 */
export async function saveNotificationSetting(
  userId: string,
  input: NotificationSettingInput,
  now: Date = new Date(),
) {
  const existing = await prisma.notificationSetting.findUnique({
    where: { userId },
    select: { enabled: true },
  });

  // A brand-new row counts as turning on: there was nothing enabled before it.
  const turningOn = input.enabled && !existing?.enabled;
  const stampToday =
    turningOn && shouldStampToday(input.sendTime, input.timeZone, now)
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
    emailEnabled: input.emailEnabled,
    pushEnabled: input.pushEnabled,
    ...(stampToday ? { lastRunOn: stampToday } : {}),
  };

  return prisma.notificationSetting.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

/**
 * Why no reminder is going out right now, most specific cause first.
 *
 * "due" is included deliberately: it is the answer when everything is in order
 * and delivery is simply imminent.
 */
export type NotificationStatusReason =
  | "notConfigured"
  | "disabled"
  | "noChannel"
  | "invalidTime"
  | "noFarm"
  | "dataEntered"
  | "alreadyHandled"
  | "beforeTime"
  | "due";

export type NotificationStatus = {
  reason: NotificationStatusReason;
  /** Last confirmed delivery through any channel, not merely an attempt. */
  lastSentAt: Date | null;
  /** Null when no further reminder is scheduled at all (off, or unusable time). */
  nextSendAt: Date | null;
  /** The zone the next-send instant should be displayed in. */
  timeZone: string;
};

/**
 * Explains the reminder schedule to the person it belongs to: when the last one
 * went out, when the next is expected, and what is standing in the way.
 *
 * Reuses evaluateDue and loadDataPresence — the very code the cron runs — rather
 * than restating the rules, so the screen cannot claim a reminder is coming when
 * the batch would skip it.
 */
export async function getNotificationStatus(
  userId: string,
  now: Date = new Date(),
): Promise<NotificationStatus> {
  const setting = await getNotificationSetting(userId);
  if (!setting) {
    return {
      reason: "notConfigured",
      lastSentAt: null,
      nextSendAt: null,
      timeZone: safeTimeZone(null),
    };
  }

  const timeZone = safeTimeZone(setting.timeZone);
  const candidate = { sendTime: setting.sendTime, timeZone, lastRunOn: setting.lastRunOn };
  const base = { lastSentAt: setting.lastSentAt, timeZone };

  // Nothing is scheduled at all in these three cases, so there is no honest
  // "next" instant to show — a time would read as a promise.
  if (!setting.enabled) return { ...base, reason: "disabled", nextSendAt: null };
  if (!setting.emailEnabled && !setting.pushEnabled) {
    return { ...base, reason: "noChannel", nextSendAt: null };
  }
  const due = evaluateDue(candidate, now);
  if (due === "invalidTime") return { ...base, reason: "invalidTime", nextSendAt: null };

  const localDate = getLocalNow(now, timeZone).date;
  const { hasFarm, hasData } = await loadDataPresence([userId], localDate);

  if (!hasFarm.has(userId)) {
    return { ...base, reason: "noFarm", nextSendAt: nextSendAt(candidate, now) };
  }

  // Ranked above the schedule reasons: once the day's eggs are in, "no reminder
  // needed" is the true answer whatever the clock says. Today is passed as
  // already handled so the next instant points at tomorrow rather than at a
  // slot that will now be skipped.
  if (hasData.has(userId)) {
    return {
      ...base,
      reason: "dataEntered",
      nextSendAt: nextSendAt({ ...candidate, lastRunOn: dateOnlyUtc(localDate) }, now),
    };
  }

  return { ...base, reason: due, nextSendAt: nextSendAt(candidate, now) };
}
