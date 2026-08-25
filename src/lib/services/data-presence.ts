import { prisma } from "@/lib/prisma";
import { dateOnlyUtc } from "@/lib/notification-schedule";

export type DataPresence = {
  /** Users who belong to at least one live farm. */
  hasFarm: Set<string>;
  /** Users whose farm already has an egg collection on the given local day. */
  hasData: Set<string>;
};

/**
 * Which of these users belong to a live farm, and which already logged an egg
 * collection on the given local day.
 *
 * The active farm lives in a cookie the cron cannot see, so every farm the user
 * belongs to counts — including one a co-worker entered data into. Both facts
 * come back in a single round trip.
 *
 * Shared by the reminder batch (deciding whether to send) and the notification
 * settings screen (explaining why nothing was sent), so the explanation can
 * never drift from the decision it describes.
 */
export async function loadDataPresence(
  userIds: string[],
  localDate: string,
): Promise<DataPresence> {
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
