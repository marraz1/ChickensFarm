import { z } from "zod";

export const createFarmSchema = z.object({
  name: z.string().trim().min(1, "Įveskite ūkio pavadinimą").max(150),
  location: z.string().trim().max(200).optional().or(z.literal("")),
});
export type CreateFarmInput = z.infer<typeof createFarmSchema>;

export const updateFarmSchema = createFarmSchema.partial();
export type UpdateFarmInput = z.infer<typeof updateFarmSchema>;
