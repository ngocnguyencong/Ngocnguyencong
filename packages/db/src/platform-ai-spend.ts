import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "./schema";

type PlatformAiSpendDatabase = PostgresJsDatabase<typeof schema>;

/**
 * Atomically reserves `amount` microunits against the platform's public-AI
 * spend for a UTC day. Returns false when the reservation would exceed
 * `limit` — a single atomic upsert, so concurrent callers never overspend.
 */
export async function reservePlatformAiSpend(
  database: PlatformAiSpendDatabase,
  input: Readonly<{ amount: bigint; day: string; limit: bigint }>,
): Promise<boolean> {
  if (input.amount > input.limit) {
    return false;
  }
  const rows = await database.execute(sql`
    INSERT INTO platform_ai_spend (day, spent_microunits)
    VALUES (${input.day}, ${input.amount})
    ON CONFLICT (day) DO UPDATE
      SET spent_microunits = platform_ai_spend.spent_microunits + ${input.amount},
          updated_at = now()
      WHERE platform_ai_spend.spent_microunits + ${input.amount} <= ${input.limit}
    RETURNING spent_microunits
  `);
  return rows[0] !== undefined;
}

/** Returns a reservation to the day's budget; never drives spend below zero. */
export async function releasePlatformAiSpend(
  database: PlatformAiSpendDatabase,
  input: Readonly<{ amount: bigint; day: string }>,
): Promise<void> {
  await database.execute(sql`
    UPDATE platform_ai_spend
    SET spent_microunits = GREATEST(0, spent_microunits - ${input.amount}),
        updated_at = now()
    WHERE day = ${input.day}
  `);
}

/**
 * Replaces a reservation with actual spend: subtracts `reserved` and adds
 * `actual`. Actual spend is truth — it may push the day past the configured
 * limit — but the counter never goes below zero.
 */
export async function settlePlatformAiSpend(
  database: PlatformAiSpendDatabase,
  input: Readonly<{ actual: bigint; day: string; reserved: bigint }>,
): Promise<void> {
  await database.execute(sql`
    UPDATE platform_ai_spend
    SET spent_microunits = GREATEST(0, spent_microunits - ${input.reserved} + ${input.actual}),
        updated_at = now()
    WHERE day = ${input.day}
  `);
}
