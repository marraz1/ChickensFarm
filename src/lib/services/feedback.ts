import { prisma } from "@/lib/prisma";
import type { FeedbackInput } from "@/lib/validation/feedback";

/**
 * Stores one piece of in-app feedback.
 *
 * Every tenant-identifying field comes from the server, not the request:
 * `userId` from the session and `farmId` from the caller's own resolved active
 * farm (see resolveActiveFarm, which only ever returns a farm the user is a
 * member of). FeedbackInput has no farmId/userId, so a client cannot attribute
 * feedback to someone else's farm or account.
 */
export function createFeedback(
  userId: string,
  farmId: string | null,
  input: FeedbackInput,
  appVersion: string | null = process.env.APP_VERSION ?? null,
) {
  return prisma.feedback.create({
    data: {
      userId,
      farmId,
      message: input.message,
      appVersion: appVersion?.slice(0, 32) || null,
    },
    select: { id: true, createdAt: true },
  });
}
