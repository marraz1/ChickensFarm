import { z } from "zod";

export const sexEnum = z.enum(["MALE", "FEMALE", "UNKNOWN"]);
export const birdCategoryEnum = z.enum([
  "CHICK",
  "PULLET",
  "COCKEREL",
  "LAYER",
  "ROOSTER",
  "OTHER",
]);

export const createBirdGroupSchema = z.object({
  breedId: z.string().min(1, "Pasirinkite veislę"),
  sex: sexEnum,
  category: birdCategoryEnum,
  quantity: z.number().int().min(0, "Kiekis negali būti neigiamas"),
  birthOrAcquiredDate: z.string().min(1, "Įveskite datą"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CreateBirdGroupInput = z.infer<typeof createBirdGroupSchema>;

export const adjustBirdGroupSchema = z.object({
  quantity: z.number().int().min(0, "Kiekis negali būti neigiamas"),
  category: birdCategoryEnum.optional(),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type AdjustBirdGroupInput = z.infer<typeof adjustBirdGroupSchema>;
