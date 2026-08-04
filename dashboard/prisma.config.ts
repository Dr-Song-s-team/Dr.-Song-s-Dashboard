import { config } from "dotenv";
import { defineConfig } from "prisma/config";

import { migrationUrl } from "./lib/env";

// Load .env.local first (Next.js convention, takes precedence),
// then fall back to .env without overwriting already-set values.
config({ path: ".env.local" });
config();

console.log("DATABASE_URL:", process.env.DATABASE_URL);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations go over the direct (unpooled) connection; see lib/env.ts.
    url: migrationUrl(),
  },
});
