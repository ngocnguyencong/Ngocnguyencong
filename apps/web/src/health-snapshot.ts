import "server-only";

import { parseServerConfig } from "@supastack/config";
import { sql } from "drizzle-orm";

import { database } from "./auth-runtime";

interface HealthProviders {
  ai: string;
  billing: string;
  email: string;
  jobs: string;
  storage: string;
}

interface HealthDependencies {
  now(): Date;
  probeDatabase(): Promise<unknown>;
  providers: HealthProviders;
  version: string;
}

function productionDependencies(): HealthDependencies {
  const config = parseServerConfig();
  return {
    now: () => new Date(),
    probeDatabase: () => database.execute(sql`select 1`),
    providers: {
      ai: config.providers.ai.kind,
      billing: config.providers.billing.kind,
      email: config.providers.email.kind,
      jobs: config.providers.jobs.kind,
      storage: config.providers.storage.kind,
    },
    version: process.env.npm_package_version ?? "0.0.0",
  };
}

/** One server-side source for the JSON health route and the status page. */
export async function getHealthSnapshot(
  dependencies: HealthDependencies = productionDependencies(),
) {
  let databaseOk = true;
  try {
    await dependencies.probeDatabase();
  } catch {
    databaseOk = false;
  }

  return {
    checks: { database: databaseOk ? "ok" : "failed" },
    providers: dependencies.providers,
    status: databaseOk ? "ok" : "degraded",
    timestamp: dependencies.now().toISOString(),
    version: dependencies.version,
  };
}
