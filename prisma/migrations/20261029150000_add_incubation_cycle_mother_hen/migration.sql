-- The hen sitting on a cycle's eggs (#188). Additive: a nullable column, so
-- existing cycles stay valid with no hen and the V1 code keeps working.

-- AlterTable
ALTER TABLE "incubation_cycles" ADD COLUMN     "motherHenId" TEXT;

-- CreateIndex
CREATE INDEX "incubation_cycles_motherHenId_idx" ON "incubation_cycles"("motherHenId");

-- AddForeignKey
ALTER TABLE "incubation_cycles" ADD CONSTRAINT "incubation_cycles_motherHenId_fkey" FOREIGN KEY ("motherHenId") REFERENCES "mother_hens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
