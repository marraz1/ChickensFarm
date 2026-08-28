import { z } from "zod";
import { parseDecimalInput } from "@/lib/format";

export const birdTransactionTypeEnum = z.enum(["PURCHASE", "SALE"]);

// Accepts a comma or dot decimal separator ("1,50" or "1.50") from the form,
// same as the expense amount field.
const priceField = z.preprocess(
  (v) => {
    const n = parseDecimalInput(v);
    return Number.isNaN(n) ? undefined : n;
  },
  z.number({ error: "Įveskite kainą" }).min(0, "Kaina negali būti neigiama"),
);

export const createBirdTransactionSchema = z.object({
  type: birdTransactionTypeEnum,
  transactionDate: z.string().min(1, "Įveskite datą"),
  quantity: z.number().int().min(1, "Kiekis turi būti bent 1"),
  unitPrice: priceField,
  // Optional so the server falls back to quantity × unitPrice; sent explicitly
  // when the user overrides a hand-agreed total.
  totalAmount: z.number().min(0).optional(),
  birdGroupId: z.string().optional().or(z.literal("")),
  counterparty: z.string().trim().max(150).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CreateBirdTransactionInput = z.infer<typeof createBirdTransactionSchema>;
