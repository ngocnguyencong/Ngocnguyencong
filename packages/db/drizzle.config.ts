import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "drizzle-kit";

// drizzle-kit only auto-loads `.env` from its cwd (packages/db); pull in the
// repo-root `.env` first so `pnpm --filter @supastack/db db:migrate` sees the
// same DATABASE_URL as the app. loadEnvFile never overrides vars already set,
// so an explicit environment (CI, exported DATABASE_URL) still wins.
const rootEnvPath = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

export default defineConfig({
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://supastack:supastack@localhost:5432/supastack",
  },
  strict: true,
  verbose: true,
});
