import { z } from "zod";

export const createEggSaleSchema = z.object({
  saleDate: z.string().min(1, "Įveskite datą"),
  quantity: z.number().int().min(1, "Kiekis turi būti bent 1"),
  unitPrice: z.number().min(0, "Kaina negali būti neigiama"),
  totalAmount: z.number().min(0).optional(),
  buyer: z.string().trim().max(150).optional().or(z.literal("")),
});
export type CreateEggSaleInput = z.infer<typeof createEggSaleSchema>;
