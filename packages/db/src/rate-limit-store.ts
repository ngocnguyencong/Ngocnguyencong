import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "./schema";

type RateLimitDatabase = PostgresJsDatabase<typeof schema>;

export interface RateLimitHit {
  readonly count: number;
  readonly expiresAt: Date;
}

export interface RateLimitStore {
  hit(key: string, windowMs: number, now: Date): Promise<RateLimitHit>;
}

/**
 * Shared fixed-window buckets backed by `rate_limit_bucket`: every replica of
 * the app counts against the same rows, so limits hold across instances. Each
 * hit is a single atomic upsert; expired buckets roll the window forward.
 */
export function createPostgresRateLimitStore(database: RateLimitDatabase): RateLimitStore {
  return Object.freeze({
    async hit(key: string, windowMs: number, now: Date): Promise<RateLimitHit> {
      const expires = new Date(now.getTime() + windowMs);
      // Raw execute params bypass postgres.js serialization for Date, so the
      // timestamps go over the wire as ISO strings with an explicit cast.
      const nowIso = now.toISOString();
      const expiresIso = expires.toISOString();
      const rows = await database.execute<RateLimitHitRow>(sql`
        INSERT INTO rate_limit_bucket (key, window_start, count, expires_at)
        VALUES (${key}, ${nowIso}::timestamptz, 1, ${expiresIso}::timestamptz)
        ON CONFLICT (key) DO UPDATE SET
          window_start = CASE WHEN rate_limit_bucket.expires_at <= ${nowIso}::timestamptz THEN ${nowIso}::timestamptz ELSE rate_limit_bucket.window_start END,
          count        = CASE WHEN rate_limit_bucket.expires_at <= ${nowIso}::timestamptz THEN 1 ELSE rate_limit_bucket.count + 1 END,
          expires_at   = CASE WHEN rate_limit_bucket.expires_at <= ${nowIso}::timestamptz THEN ${expiresIso}::timestamptz ELSE rate_limit_bucket.expires_at END
        RETURNING count, expires_at
      `);
      const row = rows[0];
      if (row === undefined) {
        throw new Error("Rate-limit upsert returned no row.");
      }
      return {
        count: row.count,
        expiresAt: row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at),
      };
    },
  });
}

/** Deletes buckets whose window already expired; returns the number removed. */
export async function pruneExpiredRateLimitBuckets(
  database: RateLimitDatabase,
  now: Date,
): Promise<number> {
  const result = await database.execute(sql`
    DELETE FROM rate_limit_bucket WHERE expires_at <= ${now.toISOString()}::timestamptz
  `);
  return result.count;
}

type RateLimitHitRow = {
  readonly count: number;
  readonly expires_at: string | Date;
};
