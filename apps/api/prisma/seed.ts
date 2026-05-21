import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth/password";
import { loadEnv } from "../src/config/env";

const prisma = new PrismaClient();
const env = loadEnv(process.env);

async function main() {
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD, env.PASSWORD_PEPPER);

  await prisma.user.upsert({
    where: { email: env.ADMIN_EMAIL },
    update: {
      role: "ADMIN",
      passwordHash,
      emailVerifiedAt: new Date()
    },
    create: {
      email: env.ADMIN_EMAIL,
      name: "SecureAuth Admin",
      passwordHash,
      role: "ADMIN",
      emailVerifiedAt: new Date()
    }
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error("Seed failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
