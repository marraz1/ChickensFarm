import { z } from "zod";

export const createEggConsumptionSchema = z.object({
  consumptionDate: z.string().min(1, "Įveskite datą"),
  quantity: z.number().int().min(1, "Kiekis turi būti bent 1"),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
export type CreateEggConsumptionInput = z.infer<typeof createEggConsumptionSchema>;
