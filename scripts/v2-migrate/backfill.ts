// The area backfill agreed for existing V1 data (#179/#180). The same
// statements ran in prisma/migrations/20261027120000_add_farm_areas (the first
// three) and 20261029120000_add_bird_transaction_area (the last) when V2's
// database was migrated; they run again here after every copy, because the
// copied rows arrive with the column defaults (groups EGGS, expenses SHARED,
// losses NULL, bird transactions EGGS). Keep them in step. Order matters: the
// sale backfill reads the group areas set above it.
export const BACKFILL_STATEMENTS = [
  // A cycle's hatched group still in CHICK → Perinimas.
  `UPDATE "bird_groups" g SET "area" = 'INC'
   WHERE g."category" = 'CHICK'
     AND EXISTS (SELECT 1 FROM "incubation_cycles" c WHERE c."resultingGroupId" = g."id")`,
  // A group with meat use → Mėsa (unless already Perinimas).
  `UPDATE "bird_groups" g SET "area" = 'MEAT'
   WHERE g."area" = 'EGGS'
     AND EXISTS (SELECT 1 FROM "bird_consumptions" b WHERE b."birdGroupId" = g."id")`,
  // A loss takes the area of its group.
  `UPDATE "losses" l SET "area" = g."area"
   FROM "bird_groups" g
   WHERE l."birdGroupId" = g."id" AND l."area" IS NULL`,
  // A sale counts in its group's area (#198); purchases stay Kiaušiniai.
  `UPDATE "bird_transactions" t SET "area" = g."area"
   FROM "bird_groups" g
   WHERE t."birdGroupId" = g."id" AND t."type" = 'SALE'`,
] as const;
