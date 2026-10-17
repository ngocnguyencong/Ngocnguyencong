import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import * as schema from "./schema";

export interface DatabaseLifecycleInput {
  databaseUrl: string;
}

export interface DatabaseLifecycleDependencies<Client, Database> {
  closeClient: (client: Client) => Promise<void>;
  createClient: (databaseUrl: string) => Client;
  createDatabase: (client: Client) => Database;
}

export interface DatabaseLifecycle<Client, Database> {
  client: Client;
  close: () => Promise<void>;
  database: Database;
}

export interface CreatePostgresDatabaseInput extends DatabaseLifecycleInput {
  maxConnections?: number;
}

export type PostgresDatabaseLifecycle = DatabaseLifecycle<Sql, PostgresJsDatabase<typeof schema>>;

/**
 * Driver options derived from the connection target. Transaction-mode poolers
 * (Supabase Supavisor on port 6543, pgbouncer) cannot hold prepared statements
 * across pooled connections, so `prepare` is disabled there; session poolers
 * and direct connections keep the driver default. `sslmode` stays in the URL
 * untouched — postgres.js already parses it.
 */
export function postgresClientOptions(
  databaseUrl: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): { readonly prepare?: boolean } {
  if (environment.DATABASE_POOLER === "transaction") {
    return { prepare: false };
  }
  try {
    const url = new URL(databaseUrl);
    if (url.port === "6543" || url.searchParams.get("pgbouncer") === "true") {
      return { prepare: false };
    }
  } catch {
    // Malformed URLs are reported by the driver at connect time.
  }
  return {};
}

export function createDatabaseLifecycle<Client, Database>(
  input: DatabaseLifecycleInput,
  dependencies: DatabaseLifecycleDependencies<Client, Database>,
): DatabaseLifecycle<Client, Database> {
  const databaseUrl = input.databaseUrl.trim();

  if (!databaseUrl) {
    throw new Error("database URL is required");
  }

  const client = dependencies.createClient(databaseUrl);

  return {
    client,
    close: async () => dependencies.closeClient(client),
    database: dependencies.createDatabase(client),
  };
}

export function createPostgresDatabase(
  input: CreatePostgresDatabaseInput,
): PostgresDatabaseLifecycle {
  return createDatabaseLifecycle(input, {
    closeClient: async (client) => client.end({ timeout: 5 }),
    createClient: (databaseUrl) =>
      postgres(databaseUrl, {
        max: input.maxConnections ?? 5,
        ...postgresClientOptions(databaseUrl),
      }),
    createDatabase: (client) => drizzle(client, { schema }),
  });
}
