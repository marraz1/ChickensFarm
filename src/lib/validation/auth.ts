import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Įveskite vardą").max(100),
  email: z.string().trim().email("Neteisingas el. pašto formatas"),
  password: z.string().min(8, "Slaptažodis turi būti bent 8 simbolių"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Neteisingas el. pašto formatas"),
  password: z.string().min(1, "Įveskite slaptažodį"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().email("Neteisingas el. pašto formatas"),
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const confirmPasswordResetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Slaptažodis turi būti bent 8 simbolių"),
});
export type ConfirmPasswordResetInput = z.infer<typeof confirmPasswordResetSchema>;
