import { z } from "zod";

export const createMotherHenSchema = z.object({
  name: z.string().trim().min(1, "Įveskite vardą / žymą").max(150),
  birdGroupId: z.string().optional().or(z.literal("")),
  photoUrl: z.string().url().optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  // Date of death (YYYY-MM-DD). Left out keeps the stored value; empty or
  // null marks the hen alive again (undoing a mistaken entry).
  diedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Neteisinga data")
    // Rejects dates that do not exist ("2026-02-30" would roll over to March).
    .refine((s) => {
      const d = new Date(`${s}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
    }, "Neteisinga data")
    .nullable()
    .optional()
    .or(z.literal("")),
});
export type CreateMotherHenInput = z.infer<typeof createMotherHenSchema>;

export const createMotherHenLogSchema = z.object({
  entryDate: z.string().min(1, "Įveskite datą"),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  photoUrl: z.string().url().optional().or(z.literal("")),
});
export type CreateMotherHenLogInput = z.infer<typeof createMotherHenLogSchema>;
