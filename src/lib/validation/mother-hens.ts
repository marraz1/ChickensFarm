import { z } from "zod";

export const createMotherHenSchema = z.object({
  name: z.string().trim().min(1, "Įveskite vardą / žymą").max(150),
  birdGroupId: z.string().optional().or(z.literal("")),
  photoUrl: z.string().url().optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type CreateMotherHenInput = z.infer<typeof createMotherHenSchema>;

export const createMotherHenLogSchema = z.object({
  entryDate: z.string().min(1, "Įveskite datą"),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  photoUrl: z.string().url().optional().or(z.literal("")),
});
export type CreateMotherHenLogInput = z.infer<typeof createMotherHenLogSchema>;
