import { z } from "zod";

// V2 farm areas (#179). Mirrors the FarmArea enum in prisma/schema.prisma.
export const farmAreaEnum = z.enum(["EGGS", "HENS", "INC", "MEAT", "SHARED"]);

// The areas a bird group can live in. HENS has no groups (a mother hen is an
// individual bird) and SHARED is for costs only; the bird_groups_area_check
// constraint enforces the same rule in the database.
export const birdGroupAreaEnum = z.enum(["EGGS", "MEAT", "INC"]);

// An expense's or loss's optional target: a bird group, a mother hen or an
// incubation cycle. On create, a missing or empty id means "none". On update,
// leaving out all three keeps the stored target, and sending any of them
// replaces it as a whole (empty string or null clears that slot). See
// targetFromInput in src/lib/services/farm-areas.ts.
const targetId = z.string().nullable().optional();

export const targetFields = {
  birdGroupId: targetId,
  motherHenId: targetId,
  incubationCycleId: targetId,
};

export type TargetFields = {
  birdGroupId?: string | null;
  motherHenId?: string | null;
  incubationCycleId?: string | null;
};

export function countTargets(input: TargetFields): number {
  return [input.birdGroupId, input.motherHenId, input.incubationCycleId].filter(Boolean).length;
}

export const SINGLE_TARGET_MESSAGE =
  "Pasirinkite tik vieną: paukščių grupę, perekšlę arba perinimo ciklą";
