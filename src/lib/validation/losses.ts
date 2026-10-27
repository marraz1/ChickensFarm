import { z } from "zod";
import { SINGLE_TARGET_MESSAGE, countTargets, targetFields } from "@/lib/validation/farm-areas";

export const lossReasonEnum = z.enum(["DISEASE", "PREDATOR", "OTHER"]);

// A loss has no area field of its own: the area comes from what was lost
// (README finance rule), so the service derives it from the target.
export const createLossSchema = z
  .object({
    lossDate: z.string().min(1, "Įveskite datą"),
    quantity: z.number().int().min(1, "Kiekis turi būti bent 1"),
    reasonType: lossReasonEnum,
    comment: z.string().trim().max(500).optional().or(z.literal("")),
    ...targetFields,
  })
  .refine((v) => countTargets(v) <= 1, { message: SINGLE_TARGET_MESSAGE, path: ["birdGroupId"] })
  .refine((v) => !v.motherHenId || v.quantity === 1, {
    message: "Perekšlės nuostolio kiekis turi būti 1",
    path: ["quantity"],
  });
export type CreateLossInput = z.infer<typeof createLossSchema>;
