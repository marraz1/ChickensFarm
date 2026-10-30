-- Incubating eggs a mother hen broke, recorded in her diary (#197), for the
-- Perekšlės Nuostoliai tab. Additive: a nullable column, so existing entries
-- stay valid and the V1 code keeps working.

-- AlterTable
ALTER TABLE "mother_hen_logs" ADD COLUMN     "brokenEggs" INTEGER;
