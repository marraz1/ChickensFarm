-- CreateEnum
CREATE TYPE "BirdCategory" AS ENUM ('LAYER', 'ROOSTER', 'OTHER');

-- AlterTable
ALTER TABLE "bird_groups" ADD COLUMN     "category" "BirdCategory" NOT NULL DEFAULT 'OTHER';
