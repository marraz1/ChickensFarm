-- V2 farm areas (#179). Additive only: every new column is nullable or has a
-- default, so existing rows stay valid and the V1 code keeps working.

-- CreateEnum
CREATE TYPE "FarmArea" AS ENUM ('EGGS', 'HENS', 'INC', 'MEAT', 'SHARED');

-- AlterTable
ALTER TABLE "bird_groups" ADD COLUMN     "area" "FarmArea" NOT NULL DEFAULT 'EGGS';

-- AlterTable
ALTER TABLE "mother_hens" ADD COLUMN     "diedAt" DATE;

-- AlterTable
ALTER TABLE "losses" ADD COLUMN     "area" "FarmArea",
ADD COLUMN     "incubationCycleId" TEXT,
ADD COLUMN     "motherHenId" TEXT;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "area" "FarmArea" NOT NULL DEFAULT 'SHARED',
ADD COLUMN     "birdGroupId" TEXT,
ADD COLUMN     "incubationCycleId" TEXT,
ADD COLUMN     "motherHenId" TEXT;

-- CreateIndex
CREATE INDEX "bird_groups_farmId_area_idx" ON "bird_groups"("farmId", "area");

-- CreateIndex
CREATE INDEX "losses_farmId_area_idx" ON "losses"("farmId", "area");

-- CreateIndex
CREATE INDEX "losses_motherHenId_idx" ON "losses"("motherHenId");

-- CreateIndex
CREATE INDEX "losses_incubationCycleId_idx" ON "losses"("incubationCycleId");

-- CreateIndex
CREATE INDEX "expenses_farmId_area_idx" ON "expenses"("farmId", "area");

-- CreateIndex
CREATE INDEX "expenses_birdGroupId_idx" ON "expenses"("birdGroupId");

-- CreateIndex
CREATE INDEX "expenses_motherHenId_idx" ON "expenses"("motherHenId");

-- CreateIndex
CREATE INDEX "expenses_incubationCycleId_idx" ON "expenses"("incubationCycleId");

-- AddForeignKey
ALTER TABLE "losses" ADD CONSTRAINT "losses_motherHenId_fkey" FOREIGN KEY ("motherHenId") REFERENCES "mother_hens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "losses" ADD CONSTRAINT "losses_incubationCycleId_fkey" FOREIGN KEY ("incubationCycleId") REFERENCES "incubation_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_birdGroupId_fkey" FOREIGN KEY ("birdGroupId") REFERENCES "bird_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_motherHenId_fkey" FOREIGN KEY ("motherHenId") REFERENCES "mother_hens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_incubationCycleId_fkey" FOREIGN KEY ("incubationCycleId") REFERENCES "incubation_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Integrity rules Prisma cannot express in the schema (it neither creates nor
-- diffs CHECK constraints, so these stay put across future migrations).
-- The services enforce the same rules with readable Lithuanian messages; these
-- are the backstop against a write path that forgets to.

-- AddCheckConstraint: a bird group lives in Kiaušiniai, Mėsa or Perinimas only.
ALTER TABLE "bird_groups" ADD CONSTRAINT "bird_groups_area_check" CHECK ("area" IN ('EGGS', 'MEAT', 'INC'));

-- AddCheckConstraint: an expense points at no more than one target.
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_single_target_check" CHECK (num_nonnulls("birdGroupId", "motherHenId", "incubationCycleId") <= 1);

-- AddCheckConstraint: a loss points at no more than one target.
ALTER TABLE "losses" ADD CONSTRAINT "losses_single_target_check" CHECK (num_nonnulls("birdGroupId", "motherHenId", "incubationCycleId") <= 1);
