import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7's config-based datasource takes a single connection URL.
// Point DATABASE_URL at Neon's *unpooled* connection string so `prisma migrate`
// works reliably; the pooled connection can be introduced later via a driver
// adapter (@prisma/adapter-neon) once traffic warrants it.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
