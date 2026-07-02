import type { NextAuthConfig } from "next-auth";

// Edge-safe subset of the NextAuth config: no providers here (Credentials needs
// Prisma/bcrypt, which pull in Node built-ins unsupported in the Edge middleware
// runtime). middleware.ts uses only this config; lib/auth.ts extends it with providers.
export default {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
