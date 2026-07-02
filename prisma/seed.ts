import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@chickensfarm.lt" },
    update: {},
    create: {
      email: "demo@chickensfarm.lt",
      name: "Demo Vartotojas",
      passwordHash,
    },
  });

  const existingFarm = await prisma.farm.findFirst({ where: { ownerId: user.id } });
  const farm =
    existingFarm ??
    (await prisma.farm.create({
      data: {
        ownerId: user.id,
        name: "Sodžiaus vištidė",
        location: "Kėdainių raj.",
        farmUsers: { create: { userId: user.id, role: "OWNER" } },
      },
    }));

  const henBreed = await prisma.breed.upsert({
    where: { id: `${farm.id}-seed-hen-breed` },
    update: {},
    create: {
      id: `${farm.id}-seed-hen-breed`,
      farmId: farm.id,
      name: "Lohmann Brown",
      birdType: "HEN",
      description: "Dedeklė vištų veislė",
    },
  });

  const existingGroup = await prisma.birdGroup.findFirst({ where: { farmId: farm.id } });
  if (!existingGroup) {
    const group = await prisma.birdGroup.create({
      data: {
        farmId: farm.id,
        breedId: henBreed.id,
        sex: "FEMALE",
        quantity: 24,
        birthOrAcquiredDate: new Date(new Date().getFullYear(), new Date().getMonth() - 6, 1),
        notes: "Pagrindinis pulkas",
      },
    });

    await prisma.birdGroupEvent.create({
      data: {
        birdGroupId: group.id,
        farmId: farm.id,
        eventType: "INITIAL",
        quantityDelta: 24,
        quantityBefore: 0,
        quantityAfter: 24,
        note: "Grupė sukurta (seed)",
        createdById: user.id,
      },
    });

    await prisma.eggCollection.create({
      data: {
        farmId: farm.id,
        birdGroupId: group.id,
        collectionDate: new Date(),
        quantity: 18,
      },
    });
  }

  console.log("Seed complete:", { userEmail: user.email, farmId: farm.id });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
