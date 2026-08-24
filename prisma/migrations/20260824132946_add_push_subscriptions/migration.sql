-- Splits the single `channel` enum into two independent booleans so a reminder
-- can go to email and push at once.
--
-- Written by hand rather than taken verbatim from `prisma migrate diff`: that
-- output dropped `channel` in the same statement that added the new columns, so
-- every row would have silently inherited the DEFAULT instead of its real value.
-- Add and backfill first, drop afterwards.

-- AlterTable: add, defaulted so the statement is safe on a live table.
ALTER TABLE "notification_settings"
    ADD COLUMN     "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN     "pushEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Backfill from the column being retired. Today every row is 'EMAIL' because
-- validation rejected 'PUSH', but the migration must not depend on an invariant
-- enforced somewhere else.
UPDATE "notification_settings"
   SET "emailEnabled" = ("channel" = 'EMAIL'),
       "pushEnabled"  = ("channel" = 'PUSH');

-- Only now is `channel` redundant.
ALTER TABLE "notification_settings" DROP COLUMN "channel";

-- DropEnum
DROP TYPE "NotificationChannel";

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
