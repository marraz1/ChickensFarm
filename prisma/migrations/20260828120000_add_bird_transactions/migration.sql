-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BirdGroupEventType" ADD VALUE 'PURCHASE';
ALTER TYPE "BirdGroupEventType" ADD VALUE 'SALE';

-- CreateEnum
CREATE TYPE "BirdTransactionType" AS ENUM ('PURCHASE', 'SALE');

-- CreateTable
CREATE TABLE "bird_transactions" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "birdGroupId" TEXT,
    "type" "BirdTransactionType" NOT NULL,
    "transactionDate" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "counterparty" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bird_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bird_transactions_farmId_transactionDate_idx" ON "bird_transactions"("farmId", "transactionDate");

-- CreateIndex
CREATE INDEX "bird_transactions_farmId_type_idx" ON "bird_transactions"("farmId", "type");

-- AddForeignKey
ALTER TABLE "bird_transactions" ADD CONSTRAINT "bird_transactions_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bird_transactions" ADD CONSTRAINT "bird_transactions_birdGroupId_fkey" FOREIGN KEY ("birdGroupId") REFERENCES "bird_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
