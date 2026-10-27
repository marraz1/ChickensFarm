// Seeds the user that e2e/signed-in.spec.ts signs in as, plus one farm so the
// app does not bounce it to /farms/new. Meant for the V2 *preview* database
// only (docs/v2-environment.md) — never V1 production, which V1 previews share.
//
//   SEED_TARGET=v2-preview DATABASE_URL=<v2 preview branch url> \
//   E2E_USER_EMAIL=... E2E_USER_PASSWORD=... npm run db:seed:e2e
//
// Idempotent: re-running resets the password and keeps the existing farm.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const email = process.env.E2E_USER_EMAIL?.trim();
const password = process.env.E2E_USER_PASSWORD;

if (process.env.SEED_TARGET !== "v2-preview") {
  console.error(
    "Refusing to seed: set SEED_TARGET=v2-preview to confirm DATABASE_URL is the V2 preview branch.",
  );
  process.exit(1);
}
if (!email || !password || password.length < 12) {
  console.error("Set E2E_USER_EMAIL and E2E_USER_PASSWORD (at least 12 characters).");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const passwordHash = await bcrypt.hash(password!, 12);
  const user = await prisma.user.upsert({
    where: { email: email! },
    update: { passwordHash },
    create: { email: email!, name: "E2E", passwordHash },
  });

  const farm = await prisma.farm.findFirst({ where: { ownerId: user.id, deletedAt: null } });
  if (!farm) {
    await prisma.farm.create({
      data: {
        ownerId: user.id,
        name: "E2E ūkis",
        farmUsers: { create: { userId: user.id, role: "OWNER" } },
      },
    });
  }
  console.log(`Seeded e2e user ${email}${farm ? "" : " with a new farm"}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
