import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import authConfig from "@/lib/auth.config";
import { checkRateLimit, getClientIp, normalizeEmailKey } from "@/lib/rate-limit";

// 8 attempts per 10 min per IP and per email — loose enough that a user
// mistyping their password a few times is never blocked, tight enough to
// blunt scripted credential-stuffing/brute-force attempts.
const LOGIN_LIMIT = { limit: 8, windowMs: 10 * 60 * 1000 };

class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "El. paštas", type: "email" },
        password: { label: "Slaptažodis", type: "password" },
      },
      authorize: async (credentials, request) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const ip = getClientIp(request);
        const emailKey = normalizeEmailKey(email);
        const ipRate = checkRateLimit(`login:ip:${ip}`, LOGIN_LIMIT);
        const emailRate = checkRateLimit(`login:email:${emailKey}`, LOGIN_LIMIT);
        if (!ipRate.allowed || !emailRate.allowed) {
          throw new RateLimitedSignin();
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
