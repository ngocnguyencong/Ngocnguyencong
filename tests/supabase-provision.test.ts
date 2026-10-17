import { describe, expect, it } from "vitest";

import {
  buildConnectionStrings,
  generateDbPassword,
  maskDatabaseUrl,
  mergeEnv,
  parseArgs,
} from "../scripts/supabase-provision.mjs";

describe("supabase-provision parseArgs", () => {
  it("parses required flags and options", () => {
    expect(
      parseArgs([
        "--org",
        "my-org",
        "--name",
        "app",
        "--region",
        "eu-west-1",
        "--plan",
        "pro",
        "--write-env",
        "--force",
        "--migrate",
        "--yes",
      ]),
    ).toEqual({
      force: true,
      migrate: true,
      name: "app",
      org: "my-org",
      plan: "pro",
      region: "eu-west-1",
      writeEnv: true,
      yes: true,
    });
  });

  it("defaults to a safe dry run", () => {
    const args = parseArgs(["--org", "o", "--name", "n", "--region", "us-east-1"]);
    expect(args).toMatchObject({ force: false, migrate: false, writeEnv: false, yes: false });
  });

  it("rejects missing required flags and unknown arguments", () => {
    expect(() => parseArgs(["--name", "n", "--region", "r"])).toThrow(/--org/);
    expect(() => parseArgs(["--org", "o", "--name", "n", "--region", "r", "--bogus"])).toThrow(
      /Unknown argument/,
    );
  });
});

describe("supabase-provision buildConnectionStrings", () => {
  it("builds direct, session, and transaction pooler URLs", () => {
    const urls = buildConnectionStrings({
      password: "pw with/special",
      ref: "abcdefghijklmnop",
      region: "eu-west-1",
    });
    expect(urls.direct).toContain("db.abcdefghijklmnop.supabase.co:5432");
    expect(urls.sessionPooler).toContain(
      "postgres.abcdefghijklmnop:pw%20with%2Fspecial@aws-0-eu-west-1.pooler.supabase.com:5432",
    );
    expect(urls.transactionPooler).toContain("pooler.supabase.com:6543");
    expect(urls.transactionPooler).toContain("pgbouncer=true");
    for (const url of Object.values(urls)) {
      expect(url).toContain("sslmode=require");
    }
  });
});

describe("supabase-provision mergeEnv", () => {
  it("appends missing keys and keeps existing values without force", () => {
    const { applied, content, skipped } = mergeEnv("DATABASE_URL=postgres://old\nOTHER=1\n", {
      DATABASE_URL: "postgres://new",
      STORAGE_REGION: "eu-west-1",
    });
    expect(applied).toEqual(["STORAGE_REGION"]);
    expect(skipped).toEqual(["DATABASE_URL"]);
    expect(content).toContain("DATABASE_URL=postgres://old");
    expect(content).toContain("STORAGE_REGION=eu-west-1");
  });

  it("overwrites existing values with force and fills empty values", () => {
    const { applied, content } = mergeEnv(
      "DATABASE_URL=postgres://old\nSTORAGE_REGION=\n",
      { DATABASE_URL: "postgres://new", STORAGE_REGION: "eu-west-1" },
      { force: true },
    );
    expect(applied).toEqual(["DATABASE_URL", "STORAGE_REGION"]);
    expect(content).toContain("DATABASE_URL=postgres://new");
    expect(content).toContain("STORAGE_REGION=eu-west-1");
  });
});

describe("supabase-provision masking", () => {
  it("never exposes the password in a masked URL", () => {
    const url =
      "postgres://postgres.ref:super-secret-pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require";
    const masked = maskDatabaseUrl(url);
    expect(masked).not.toContain("super-secret-pw");
    expect(masked).toContain("****");
    expect(masked).toContain("postgres.ref");
  });

  it("generates strong unique passwords", () => {
    const a = generateDbPassword();
    const b = generateDbPassword();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
});
