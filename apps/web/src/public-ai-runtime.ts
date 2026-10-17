import "server-only";

import { parseServerConfig } from "@supastack/config";
import {
  releasePlatformAiSpend,
  reservePlatformAiSpend,
  settlePlatformAiSpend,
} from "@supastack/db";

import { database } from "./auth-runtime";
import { getChatStreamRuntime } from "./ai-task-runtime";
import { createPublicAiRunner } from "./public-ai";

const serverConfig = parseServerConfig();

let runner: ReturnType<typeof createPublicAiRunner> | null = null;

/**
 * Shared public AI runner: the platform model router plus the Postgres-backed
 * daily spend ledger (`platform_ai_spend`). Budget 0 (the default) keeps
 * public AI disabled — every call throws `PublicAiBudgetExceededError`.
 */
export function getPublicAiRunner() {
  const dailyBudgetMicrounits = serverConfig.publicAi.dailyBudgetMicrounits;
  runner ??= createPublicAiRunner({
    dailyBudgetMicrounits,
    now: () => new Date(),
    release: (input) => releasePlatformAiSpend(database, input),
    reserve: (input) =>
      reservePlatformAiSpend(database, { ...input, limit: dailyBudgetMicrounits }),
    router: getChatStreamRuntime().router,
    settle: (input) => settlePlatformAiSpend(database, input),
  });
  return runner;
}
