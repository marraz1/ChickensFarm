import { prisma } from "@/lib/prisma";
import { sendReminderEmail } from "@/lib/email";
import { dateOnlyUtc, getLocalNow, isDue } from "@/lib/notification-schedule";

/** Upper bound per run. The lateness window makes a partial batch self-healing:
 *  whatever is left over is still due on the next tick. */
const MAX_PER_RUN = 500;
const SEND_CHUNK = 5;

export type ReminderBatchResult = {
  checked: number;
  due: number;
  sent: number;
  skipped: number;
  failed: number;
};

export async function runReminderBatch(now: Date = new Date()): Promise<ReminderBatchResult> {
  const settings = await prisma.notificationSetting.findMany({
    // channel is filtered here too, so a PUSH row could never be picked up by
    // the email sender if one ever got stored.
    where: { enabled: true, channel: "EMAIL" },
    take: MAX_PER_RUN,
    select: {
      id: true,
      userId: true,
      message: true,
      sendTime: true,
      timeZone: true,
      lastRunOn: true,
      user: { select: { email: true } },
    },
  });

  const due = settings.filter((s) => isDue(s, now));
  if (due.length === 0) {
    return { checked: settings.length, due: 0, sent: 0, skipped: 0, failed: 0 };
  }

  // Group by local date so the "did they enter data today?" lookup is one query
  // per distinct day — normally exactly one — instead of one per user.
  const byLocalDate = new Map<string, typeof due>();
  for (const setting of due) {
    const localDate = getLocalNow(now, setting.timeZone).date;
    const bucket = byLocalDate.get(localDate);
    if (bucket) bucket.push(setting);
    else byLocalDate.set(localDate, [setting]);
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const [localDate, group] of byLocalDate) {
    const { hasFarm, hasData } = await loadDataPresence(
      group.map((s) => s.userId),
      localDate,
    );
    const today = dateOnlyUtc(localDate);

    for (let i = 0; i < group.length; i += SEND_CHUNK) {
      const chunk = group.slice(i, i + SEND_CHUNK);
      const results = await Promise.allSettled(
        chunk.map(async (setting) => {
          // Claim the day BEFORE sending. At-most-once is the right trade for a
          // nag reminder: a crash between claim and send loses today, which is
          // far better than mailing the same person twice.
          const claimed = await prisma.notificationSetting.updateMany({
            where: {
              id: setting.id,
              enabled: true,
              // `lt`, not `not`: a stamp in the future (a user's zone moved
              // westward) must suppress, whereas `not` would re-claim it.
              OR: [{ lastRunOn: null }, { lastRunOn: { lt: today } }],
            },
            data: { lastRunOn: today },
          });
          if (claimed.count === 0) return "skipped" as const;

          // A user with no farm can never satisfy the condition, so reminding
          // them daily would be pure noise. The day is already claimed above.
          if (!hasFarm.has(setting.userId)) return "skipped" as const;
          if (hasData.has(setting.userId)) return "skipped" as const;
          if (!setting.user.email) return "skipped" as const;

          await sendReminderEmail(setting.user.email, setting.message);
          await prisma.notificationSetting.update({
            where: { id: setting.id },
            data: { lastSentAt: now },
          });
          return "sent" as const;
        }),
      );

      for (const result of results) {
        if (result.status === "rejected") {
          failed += 1;
          console.error("[reminders] send failed", result.reason);
        } else if (result.value === "sent") sent += 1;
        else skipped += 1;
      }
    }
  }

  return { checked: settings.length, due: due.length, sent, skipped, failed };
}

/**
 * Which of these users belong to a live farm, and which already logged an egg
 * collection on the given local day.
 *
 * The active farm lives in a cookie the cron cannot see, so every farm the user
 * belongs to counts — including one a co-worker entered data into. Both facts
 * come back in a single round trip.
 */
async function loadDataPresence(userIds: string[], localDate: string) {
  const rows = await prisma.farmUser.findMany({
    // Soft-deleted farms must not count, or a record left in one would silence
    // the reminder forever.
    where: { userId: { in: userIds }, farm: { deletedAt: null } },
    select: {
      userId: true,
      farm: {
        select: {
          eggCollections: {
            where: { collectionDate: dateOnlyUtc(localDate) },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  const hasFarm = new Set<string>();
  const hasData = new Set<string>();
  for (const row of rows) {
    hasFarm.add(row.userId);
    if (row.farm.eggCollections.length > 0) hasData.add(row.userId);
  }
  return { hasFarm, hasData };
}
