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
  name: z.string().trim().max(100).optional().or(z.literal("")),
  sex: sexEnum,
  category: birdCategoryEnum,
  quantity: z.number().int().min(0, "Kiekis negali būti neigiamas"),
  birthOrAcquiredDate: z.string().min(1, "Įveskite datą"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CreateBirdGroupInput = z.infer<typeof createBirdGroupSchema>;

// Full edit of a group. Every field is editable (F: koreguoti visą informaciją).
// A change to `quantity` is recorded as a MANUAL_ADJUSTMENT event, with
// `adjustmentNote` as its optional reason.
export const updateBirdGroupSchema = createBirdGroupSchema.extend({
  adjustmentNote: z.string().trim().max(500).optional().or(z.literal("")),
});
export type UpdateBirdGroupInput = z.infer<typeof updateBirdGroupSchema>;
