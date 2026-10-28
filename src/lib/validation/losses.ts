import { z } from "zod";
import {
  SINGLE_TARGET_MESSAGE,
  countTargets,
  farmAreaEnum,
  targetFields,
} from "@/lib/validation/farm-areas";

export const lossReasonEnum = z.enum(["DISEASE", "PREDATOR", "OTHER"]);

// A loss has no area of its own to choose: the area comes from what was lost
// (README finance rule 5), so the service derives it from the target.
//
// `area` is the area the form was opened from (#195). When sent, a target is
// required and must belong to that area; the V1 form sends none.
export const createLossSchema = z
  .object({
    lossDate: z.string().min(1, "Įveskite datą"),
    quantity: z.number().int().min(1, "Kiekis turi būti bent 1"),
    reasonType: lossReasonEnum,
    comment: z.string().trim().max(500).optional().or(z.literal("")),
    area: farmAreaEnum.exclude(["SHARED"]).optional(),
    ...targetFields,
  })
  .refine((v) => countTargets(v) <= 1, { message: SINGLE_TARGET_MESSAGE, path: ["birdGroupId"] })
  .refine((v) => !v.area || countTargets(v) === 1, {
    message: "Pasirinkite, kas prarasta",
    path: ["birdGroupId"],
  })
  .refine((v) => !v.motherHenId || v.quantity === 1, {
    message: "Perekšlės nuostolio kiekis turi būti 1",
    path: ["quantity"],
  });
export type CreateLossInput = z.infer<typeof createLossSchema>;
