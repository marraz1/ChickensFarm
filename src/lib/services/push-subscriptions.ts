import { prisma } from "@/lib/prisma";
import type { PushSubscriptionInput } from "@/lib/validation/push";

/**
 * Stores a device's subscription.
 *
 * Upserted on `endpoint`, not created: a browser re-subscribing after a permission
 * reset or a key rotation returns the same endpoint, and inserting would leave a
 * duplicate that gets pushed to twice. The upsert also re-points a row at the
 * current user, which matters on a shared device where someone else signed in.
 */
export async function savePushSubscription(
  userId: string,
  input: PushSubscriptionInput,
  userAgent: string | null,
) {
  const data = {
    // In the update branch on purpose: if this browser previously belonged to a
    // different account, the row must MOVE rather than duplicate. Leaving userId
    // out would keep pushing the previous user's reminders to this device.
    userId,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    userAgent,
  };

  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: { endpoint: input.endpoint, ...data },
    update: data,
  });

  // Registering a device is the user saying "notify me here", so persist the
  // preference now instead of relying on them also pressing Save — otherwise
  // they grant permission, see success, navigate away, and nothing ever arrives.
  // updateMany, not upsert: a no-op when no settings row exists yet, so it never
  // has to duplicate the defaults that saveNotificationSetting owns.
  await prisma.notificationSetting.updateMany({
    where: { userId },
    data: { pushEnabled: true },
  });

  return subscription;
}

/** Scoped by userId as well as endpoint so one account cannot delete another's. */
export async function deletePushSubscription(userId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });

  // Mirror of the save path: with no devices left, push is off. Checked rather
  // than assumed, because the user may still have another device registered.
  const remaining = await prisma.pushSubscription.count({ where: { userId } });
  if (remaining === 0) {
    await prisma.notificationSetting.updateMany({
      where: { userId },
      data: { pushEnabled: false },
    });
  }
}

export function countPushSubscriptions(userId: string) {
  return prisma.pushSubscription.count({ where: { userId } });
}
