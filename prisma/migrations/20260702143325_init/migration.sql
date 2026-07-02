-- CreateEnum
CREATE TYPE "FarmRole" AS ENUM ('OWNER', 'WORKER');

-- CreateEnum
CREATE TYPE "BirdType" AS ENUM ('HEN', 'GOOSE', 'DUCK', 'TURKEY', 'OTHER');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LossReasonType" AS ENUM ('DISEASE', 'PREDATOR', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FEED', 'VITAMINS', 'MEDICINE', 'PRODUCTIVITY', 'OTHER');

-- CreateEnum
CREATE TYPE "EggQuality" AS ENUM ('HEALTHY', 'BROKEN');

-- CreateEnum
CREATE TYPE "BirdGroupEventType" AS ENUM ('INITIAL', 'MANUAL_ADJUSTMENT', 'LOSS', 'INCUBATION_HATCH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farms" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farm_users" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "FarmRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farm_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breeds" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birdType" "BirdType" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "breeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bird_groups" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "breedId" TEXT NOT NULL,
    "sex" "Sex" NOT NULL DEFAULT 'UNKNOWN',
    "quantity" INTEGER NOT NULL,
    "birthOrAcquiredDate" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bird_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bird_group_events" (
    "id" TEXT NOT NULL,
    "birdGroupId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "eventType" "BirdGroupEventType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "quantityBefore" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "bird_group_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mother_hens" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "birdGroupId" TEXT,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mother_hens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mother_hen_logs" (
    "id" TEXT NOT NULL,
    "motherHenId" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "note" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mother_hen_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "egg_collections" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "birdGroupId" TEXT,
    "collectionDate" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quality" "EggQuality",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egg_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "egg_sales" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "saleDate" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "buyer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egg_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "losses" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "birdGroupId" TEXT,
    "lossDate" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reasonType" "LossReasonType" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "losses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "expenseDate" DATE NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubation_cycles" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "sourceDescription" TEXT,
    "eggSourceGroupId" TEXT,
    "startDate" DATE NOT NULL,
    "eggsTotal" INTEGER,
    "eggsFertile" INTEGER,
    "eggsInfertile" INTEGER,
    "hatchDate" DATE,
    "hatchedCount" INTEGER,
    "resultingGroupId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incubation_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubation_growth_logs" (
    "id" TEXT NOT NULL,
    "incubationCycleId" TEXT NOT NULL,
    "logDate" DATE NOT NULL,
    "aliveCount" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incubation_growth_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "farms_ownerId_idx" ON "farms"("ownerId");

-- CreateIndex
CREATE INDEX "farm_users_userId_idx" ON "farm_users"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "farm_users_farmId_userId_key" ON "farm_users"("farmId", "userId");

-- CreateIndex
CREATE INDEX "breeds_farmId_idx" ON "breeds"("farmId");

-- CreateIndex
CREATE INDEX "bird_groups_farmId_idx" ON "bird_groups"("farmId");

-- CreateIndex
CREATE INDEX "bird_groups_farmId_breedId_idx" ON "bird_groups"("farmId", "breedId");

-- CreateIndex
CREATE INDEX "bird_group_events_birdGroupId_createdAt_idx" ON "bird_group_events"("birdGroupId", "createdAt");

-- CreateIndex
CREATE INDEX "bird_group_events_farmId_idx" ON "bird_group_events"("farmId");

-- CreateIndex
CREATE INDEX "mother_hens_farmId_idx" ON "mother_hens"("farmId");

-- CreateIndex
CREATE INDEX "mother_hen_logs_motherHenId_entryDate_idx" ON "mother_hen_logs"("motherHenId", "entryDate");

-- CreateIndex
CREATE INDEX "egg_collections_farmId_collectionDate_idx" ON "egg_collections"("farmId", "collectionDate");

-- CreateIndex
CREATE INDEX "egg_sales_farmId_saleDate_idx" ON "egg_sales"("farmId", "saleDate");

-- CreateIndex
CREATE INDEX "losses_farmId_lossDate_idx" ON "losses"("farmId", "lossDate");

-- CreateIndex
CREATE INDEX "losses_farmId_reasonType_idx" ON "losses"("farmId", "reasonType");

-- CreateIndex
CREATE INDEX "expenses_farmId_expenseDate_idx" ON "expenses"("farmId", "expenseDate");

-- CreateIndex
CREATE INDEX "expenses_farmId_category_idx" ON "expenses"("farmId", "category");

-- CreateIndex
CREATE INDEX "incubation_cycles_farmId_startDate_idx" ON "incubation_cycles"("farmId", "startDate");

-- CreateIndex
CREATE INDEX "incubation_growth_logs_incubationCycleId_logDate_idx" ON "incubation_growth_logs"("incubationCycleId", "logDate");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_users" ADD CONSTRAINT "farm_users_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_users" ADD CONSTRAINT "farm_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breeds" ADD CONSTRAINT "breeds_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bird_groups" ADD CONSTRAINT "bird_groups_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bird_groups" ADD CONSTRAINT "bird_groups_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "breeds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bird_group_events" ADD CONSTRAINT "bird_group_events_birdGroupId_fkey" FOREIGN KEY ("birdGroupId") REFERENCES "bird_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bird_group_events" ADD CONSTRAINT "bird_group_events_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bird_group_events" ADD CONSTRAINT "bird_group_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mother_hens" ADD CONSTRAINT "mother_hens_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mother_hens" ADD CONSTRAINT "mother_hens_birdGroupId_fkey" FOREIGN KEY ("birdGroupId") REFERENCES "bird_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mother_hen_logs" ADD CONSTRAINT "mother_hen_logs_motherHenId_fkey" FOREIGN KEY ("motherHenId") REFERENCES "mother_hens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egg_collections" ADD CONSTRAINT "egg_collections_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egg_collections" ADD CONSTRAINT "egg_collections_birdGroupId_fkey" FOREIGN KEY ("birdGroupId") REFERENCES "bird_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egg_sales" ADD CONSTRAINT "egg_sales_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "losses" ADD CONSTRAINT "losses_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "losses" ADD CONSTRAINT "losses_birdGroupId_fkey" FOREIGN KEY ("birdGroupId") REFERENCES "bird_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_cycles" ADD CONSTRAINT "incubation_cycles_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_cycles" ADD CONSTRAINT "incubation_cycles_eggSourceGroupId_fkey" FOREIGN KEY ("eggSourceGroupId") REFERENCES "bird_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_cycles" ADD CONSTRAINT "incubation_cycles_resultingGroupId_fkey" FOREIGN KEY ("resultingGroupId") REFERENCES "bird_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_growth_logs" ADD CONSTRAINT "incubation_growth_logs_incubationCycleId_fkey" FOREIGN KEY ("incubationCycleId") REFERENCES "incubation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
