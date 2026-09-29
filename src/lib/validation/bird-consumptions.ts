import { z } from "zod";

// The bird group is required here, unlike on a loss or a bird sale: the whole
// point of the record is to take those birds out of a named group, so there is
// nothing to save without one.
export const createBirdConsumptionSchema = z.object({
  consumptionDate: z.string().min(1, "Įveskite datą"),
  birdGroupId: z.string().min(1, "Pasirinkite paukščių grupę"),
  quantity: z.number().int().min(1, "Kiekis turi būti bent 1"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CreateBirdConsumptionInput = z.infer<typeof createBirdConsumptionSchema>;
