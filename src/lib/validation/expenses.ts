import { z } from "zod";
import { parseDecimalInput } from "@/lib/format";

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
  z.number({ error: "Įveskite sumą" }).min(0.01, "Suma turi būti didesnė už 0")
);

export const createExpenseSchema = z.object({
  expenseDate: z.string().min(1, "Įveskite datą"),
  category: expenseCategoryEnum,
  amount: amountField,
  description: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
