import { z } from "zod";
import { parseDecimalInput } from "@/lib/format";
import {
  SINGLE_TARGET_MESSAGE,
  countTargets,
  farmAreaEnum,
  targetFields,
  type TargetFields,
} from "@/lib/validation/farm-areas";

export const expenseCategoryEnum = z.enum([
  "FEED",
  "VITAMINS",
  "MEDICINE",
  "PRODUCTIVITY",
  "OTHER",
]);

// Accepts a comma or dot decimal separator ("1,50" or "1.50") from the form.
const amountField = z.preprocess(
  (v) => {
    const n = parseDecimalInput(v);
    return Number.isNaN(n) ? undefined : n;
  },
  z.number({ error: "Įveskite sumą" }).min(0.01, "Suma turi būti didesnė už 0"),
);

const expenseFields = z.object({
  expenseDate: z.string().min(1, "Įveskite datą"),
  category: expenseCategoryEnum,
  amount: amountField,
  description: z.string().trim().max(500).optional().or(z.literal("")),
  area: farmAreaEnum.optional(),
  ...targetFields,
});
const oneTarget = (v: TargetFields) => countTargets(v) <= 1;
const ONE_TARGET = { message: SINGLE_TARGET_MESSAGE, path: ["birdGroupId"] };

// For an update and the service: left out, `area` is the stored one on update,
// and on create it is taken from the target, else "Bendra".
export const createExpenseSchema = expenseFields.refine(oneTarget, ONE_TARGET);
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

// A new expense, and the general form (#193): the farmer must choose the area
// ("Sritis"), "Bendra" included, so a shared cost is never filed by default.
export const newExpenseSchema = expenseFields
  .extend({ area: z.enum(farmAreaEnum.options, { error: "Pasirinkite sritį" }) })
  .refine(oneTarget, ONE_TARGET);
