import { z } from "zod";

export const expenseCategoryEnum = z.enum([
  "FEED",
  "VITAMINS",
  "MEDICINE",
  "PRODUCTIVITY",
  "OTHER",
]);

export const createExpenseSchema = z.object({
  expenseDate: z.string().min(1, "Įveskite datą"),
  category: expenseCategoryEnum,
  amount: z.number().min(0.01, "Suma turi būti didesnė už 0"),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
