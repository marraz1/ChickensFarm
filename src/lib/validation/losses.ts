import { z } from "zod";

export const lossReasonEnum = z.enum(["DISEASE", "PREDATOR", "OTHER"]);

export const createLossSchema = z.object({
  lossDate: z.string().min(1, "Įveskite datą"),
  quantity: z.number().int().min(1, "Kiekis turi būti bent 1"),
  reasonType: lossReasonEnum,
  birdGroupId: z.string().optional().or(z.literal("")),
  comment: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CreateLossInput = z.infer<typeof createLossSchema>;
