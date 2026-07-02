import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import type { RegisterInput } from "@/lib/validation/auth";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error("EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  return prisma.user.create({
    data: { email: input.email, name: input.name, passwordHash },
  });
}

export async function requestPasswordReset(email: string, appUrl: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always behave the same whether or not the user exists, to avoid leaking registered emails.
  if (!user) return;

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${appUrl}/reset-password/${rawToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

export async function confirmPasswordReset(rawToken: string, newPassword: string) {
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new Error("INVALID_TOKEN");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
}
