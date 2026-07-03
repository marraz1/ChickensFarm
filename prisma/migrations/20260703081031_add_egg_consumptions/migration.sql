-- CreateTable
CREATE TABLE "egg_consumptions" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "consumptionDate" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egg_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "egg_consumptions_farmId_consumptionDate_idx" ON "egg_consumptions"("farmId", "consumptionDate");

-- AddForeignKey
ALTER TABLE "egg_consumptions" ADD CONSTRAINT "egg_consumptions_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
