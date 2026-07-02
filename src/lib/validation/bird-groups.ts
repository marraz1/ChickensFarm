import { z } from "zod";

export const sexEnum = z.enum(["MALE", "FEMALE", "UNKNOWN"]);

export const createBirdGroupSchema = z.object({
  breedId: z.string().min(1, "Pasirinkite veislę"),
  sex: sexEnum,
  quantity: z.number().int().min(0, "Kiekis negali būti neigiamas"),
  birthOrAcquiredDate: z.string().min(1, "Įveskite datą"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CreateBirdGroupInput = z.infer<typeof createBirdGroupSchema>;

export const adjustBirdGroupSchema = z.object({
  quantity: z.number().int().min(0, "Kiekis negali būti neigiamas"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type AdjustBirdGroupInput = z.infer<typeof adjustBirdGroupSchema>;
