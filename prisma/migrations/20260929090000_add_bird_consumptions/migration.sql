-- AlterEnum
ALTER TYPE "BirdGroupEventType" ADD VALUE 'MEAT_USE';

-- CreateTable
CREATE TABLE "bird_consumptions" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "birdGroupId" TEXT NOT NULL,
    "consumptionDate" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bird_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bird_consumptions_farmId_consumptionDate_idx" ON "bird_consumptions"("farmId", "consumptionDate");

-- CreateIndex
CREATE INDEX "bird_consumptions_birdGroupId_idx" ON "bird_consumptions"("birdGroupId");

-- AddForeignKey
ALTER TABLE "bird_consumptions" ADD CONSTRAINT "bird_consumptions_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bird_consumptions" ADD CONSTRAINT "bird_consumptions_birdGroupId_fkey" FOREIGN KEY ("birdGroupId") REFERENCES "bird_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
