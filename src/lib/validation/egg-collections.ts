import { z } from "zod";

export const eggQualityEnum = z.enum(["HEALTHY", "BROKEN"]);

export const createEggCollectionSchema = z.object({
  collectionDate: z.string().min(1, "Įveskite datą"),
  quantity: z.number().int().min(1, "Kiekis turi būti bent 1"),
  birdGroupId: z.string().optional().or(z.literal("")),
  quality: eggQualityEnum.optional(),
});
export type CreateEggCollectionInput = z.infer<typeof createEggCollectionSchema>;
