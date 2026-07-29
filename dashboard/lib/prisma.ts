/**
 * Shared Prisma client singleton.
 *
 * Prisma 7 requires an explicit driver adapter.
 * We use PrismaPg (backed by the `pg` package) which works with any
 * standard PostgreSQL connection string, including Neon.
 *
 * Import this module from server components, API routes, and Server Actions:
 *   import { prisma } from "@/lib/prisma"
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { requireEnv } from "./env";

// Next.js loads .env.local itself, so no dotenv call is needed here.
const connectionString = requireEnv("DATABASE_URL");

// In Next.js development, module hot-reload would create multiple instances
// without the global guard below.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

const adapter = new PrismaPg({ connectionString });

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
