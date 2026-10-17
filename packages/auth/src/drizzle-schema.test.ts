import { getAuthTables } from "@better-auth/core/db";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { parseServerConfig } from "@supastack/config";
import * as schema from "@supastack/db/schema";
import { describe, expect, it } from "vitest";

import { createBetterAuthOptions } from "./index";

const origin = "http://localhost:3000";
const authOptions = createBetterAuthOptions(
  parseServerConfig({ APP_URL: origin, EXPO_PUBLIC_API_URL: origin }),
  {
    admitAuthMail: async () => true,
    sendMagicLink: async () => undefined,
    sendVerificationOTP: async () => undefined,
  },
);

/**
 * A stub drizzle db: the adapter's checkMissingFields runs before any query,
 * and insert().values().returning() is the only chain create() reaches.
 */
function createStubDb() {
  return {
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => [values],
      }),
    }),
  };
}

function createAdapter() {
  const adapterFactory = drizzleAdapter(createStubDb() as never, { provider: "pg", schema });
  return adapterFactory(authOptions as never) as {
    create(input: { model: string; data: Record<string, unknown> }): Promise<unknown>;
  };
}

describe("drizzle schema ↔ Better Auth contract", () => {
  it("creates an account row with an issuer (the sign-up path from issue #2)", async () => {
    const adapter = createAdapter();

    const created = (await adapter.create({
      model: "account",
      data: {
        accountId: "user_1",
        issuer: "local:credential",
        providerId: "credential",
        userId: "user_1",
        password: "hashed",
      },
    })) as Record<string, unknown>;

    expect(created.issuer).toBe("local:credential");
  });

  it("declares every field Better Auth expects on every model it uses", () => {
    const tables = getAuthTables(authOptions as never);
    const schemaRecord = schema as unknown as Record<string, Record<string, unknown>>;

    const missing: string[] = [];
    for (const table of Object.values(tables)) {
      const drizzleTable = schemaRecord[table.modelName];
      if (!drizzleTable) {
        missing.push(`${table.modelName}.* (table missing)`);
        continue;
      }
      for (const [fieldKey, attributes] of Object.entries(table.fields)) {
        const fieldName = (attributes as { fieldName?: string }).fieldName ?? fieldKey;
        if (drizzleTable[fieldName] === undefined) {
          missing.push(`${table.modelName}.${fieldName}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
