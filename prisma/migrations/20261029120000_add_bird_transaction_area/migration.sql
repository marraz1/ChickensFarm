-- The area a bird sale or purchase counts in (#198). Additive: the column has a
-- default, so existing rows stay valid and the V1 code keeps working.

-- AlterTable
ALTER TABLE "bird_transactions" ADD COLUMN     "area" "FarmArea" NOT NULL DEFAULT 'EGGS';

-- CreateIndex
CREATE INDEX "bird_transactions_farmId_area_idx" ON "bird_transactions"("farmId", "area");

-- Backfill: a sale takes its group's area; purchases and unlinked sales stay
-- Kiaušiniai. Mirrored in scripts/v2-migrate/backfill.ts — keep the two in step.
UPDATE "bird_transactions" t SET "area" = g."area"
FROM "bird_groups" g
WHERE t."birdGroupId" = g."id" AND t."type" = 'SALE';
