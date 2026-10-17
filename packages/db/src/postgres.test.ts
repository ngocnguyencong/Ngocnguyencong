import { describe, expect, it } from "vitest";

const postgresModule = await import("./" + "postgres.js").catch(() => null);

describe("PostgreSQL database lifecycle", () => {
  it("exports a lifecycle factory without loading a connection string from global state", () => {
    expect(postgresModule).toEqual(
      expect.objectContaining({
        createDatabaseLifecycle: expect.any(Function),
        createPostgresDatabase: expect.any(Function),
      }),
    );
  });

  it("opens and closes only the injected client", async () => {
    if (!postgresModule) {
      return;
    }

    const client = { id: "client_01" };
    const database = { id: "database_01" };
    const createdUrls: string[] = [];
    const closedClients: unknown[] = [];

    const lifecycle = postgresModule.createDatabaseLifecycle(
      { databaseUrl: "postgres://postgres:postgres@localhost:5432/supastack" },
      {
        closeClient: async (value: unknown) => {
          closedClients.push(value);
        },
        createClient: (databaseUrl: string) => {
          createdUrls.push(databaseUrl);
          return client;
        },
        createDatabase: (value: unknown) => {
          expect(value).toBe(client);
          return database;
        },
      },
    );

    expect(lifecycle.database).toBe(database);
    expect(createdUrls).toEqual(["postgres://postgres:postgres@localhost:5432/supastack"]);

    await lifecycle.close();

    expect(closedClients).toEqual([client]);
  });

  it("rejects an empty database URL before creating a client", () => {
    if (!postgresModule) {
      return;
    }

    expect(() =>
      postgresModule.createDatabaseLifecycle(
        { databaseUrl: "   " },
        {
          closeClient: async () => undefined,
          createClient: () => ({}) as never,
          createDatabase: () => ({}) as never,
        },
      ),
    ).toThrow("database URL is required");
  });
});

describe("postgresClientOptions", () => {
  it("keeps driver defaults for direct connections and session poolers", () => {
    if (!postgresModule) {
      return;
    }

    expect(
      postgresModule.postgresClientOptions(
        "postgres://postgres:secret@db.example.supabase.co:5432/postgres?sslmode=require",
        {},
      ),
    ).toEqual({});
    expect(
      postgresModule.postgresClientOptions(
        "postgres://postgres.project:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres",
        {},
      ),
    ).toEqual({});
  });

  it("disables prepared statements on the transaction pooler port", () => {
    if (!postgresModule) {
      return;
    }

    expect(
      postgresModule.postgresClientOptions(
        "postgres://postgres.project:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
        {},
      ),
    ).toEqual({ prepare: false });
  });

  it("disables prepared statements when pgbouncer=true is in the URL", () => {
    if (!postgresModule) {
      return;
    }

    expect(
      postgresModule.postgresClientOptions(
        "postgres://postgres:secret@localhost:5432/postgres?pgbouncer=true",
        {},
      ),
    ).toEqual({ prepare: false });
  });

  it("honors the DATABASE_POOLER=transaction override on any port", () => {
    if (!postgresModule) {
      return;
    }

    expect(
      postgresModule.postgresClientOptions("postgres://postgres:secret@localhost:5432/postgres", {
        DATABASE_POOLER: "transaction",
      }),
    ).toEqual({ prepare: false });
  });

  it("leaves malformed URLs to the driver and ignores unrelated env values", () => {
    if (!postgresModule) {
      return;
    }

    expect(postgresModule.postgresClientOptions("not a url", {})).toEqual({});
    expect(
      postgresModule.postgresClientOptions("postgres://u:p@localhost:5432/db", {
        DATABASE_POOLER: "session",
      }),
    ).toEqual({});
  });
});
