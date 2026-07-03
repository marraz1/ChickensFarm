import { z } from "zod";

// Start a new incubation cycle (F10.1)
export const createIncubationCycleSchema = z.object({
  startDate: z.string().min(1, "Įveskite pradžios datą"),
  sourceDescription: z.string().trim().max(300).optional().or(z.literal("")),
  eggSourceGroupId: z.string().optional().or(z.literal("")),
  eggsTotal: z.number().int().min(0).optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type CreateIncubationCycleInput = z.infer<typeof createIncubationCycleSchema>;

// A cycle progresses through candling (F10.2) and hatching (F10.3). Both are optional
// PATCH updates; the "action" field tells the service which step is being recorded so it
// can apply the right side effects (hatch finalization touches a bird group).
export const candlingSchema = z.object({
  action: z.literal("candling"),
  eggsFertile: z.number().int().min(0),
  eggsInfertile: z.number().int().min(0),
});

export const hatchSchema = z.object({
  action: z.literal("hatch"),
  hatchDate: z.string().min(1, "Įveskite išsiritimo datą"),
  hatchedCount: z.number().int().min(0),
  // Where the hatched chicks go (F4.2): a brand-new day-old cohort (default) or an
  // existing group. When creating new, we need a breed for the cohort.
  target: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("none") }),
    z.object({ mode: z.literal("new"), breedId: z.string().min(1, "Pasirinkite veislę") }),
    z.object({ mode: z.literal("existing"), birdGroupId: z.string().min(1, "Pasirinkite grupę") }),
  ]),
});

export const updateIncubationCycleSchema = z.discriminatedUnion("action", [
  candlingSchema,
  hatchSchema,
]);
export type UpdateIncubationCycleInput = z.infer<typeof updateIncubationCycleSchema>;
export type CandlingInput = z.infer<typeof candlingSchema>;
export type HatchInput = z.infer<typeof hatchSchema>;

// Periodic survival tracking of the hatched chicks (F10.4)
export const createGrowthLogSchema = z.object({
  logDate: z.string().min(1, "Įveskite datą"),
  aliveCount: z.number().int().min(0),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type CreateGrowthLogInput = z.infer<typeof createGrowthLogSchema>;
