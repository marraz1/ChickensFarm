import { z } from "zod";

export const birdTypeEnum = z.enum(["HEN", "GOOSE", "DUCK", "TURKEY", "OTHER"]);

export const createBreedSchema = z.object({
  name: z.string().trim().min(1, "Įveskite veislės pavadinimą").max(150),
  birdType: birdTypeEnum,
  description: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CreateBreedInput = z.infer<typeof createBreedSchema>;

export const updateBreedSchema = createBreedSchema.partial();
export type UpdateBreedInput = z.infer<typeof updateBreedSchema>;
