import { describe, expect, it } from "vitest";

import {
  assessPooler,
  checkStorageEndpoint,
  computePendingMigrations,
  parseArgs,
  rlsRiskReport,
} from "../scripts/supabase-doctor.mjs";

describe("supabase-doctor parseArgs", () => {
  it("detects --fix-rls", () => {
    expect(parseArgs([])).toEqual({ fixRls: false });
    expect(parseArgs(["--fix-rls"])).toEqual({ fixRls: true });
  });
});

describe("supabase-doctor assessPooler", () => {
  it("classifies transaction, session, and direct targets", () => {
    expect(assessPooler("postgres://u:p@aws-0-eu-west-1.pooler.supabase.com:6543/db", {})).toEqual({
      consistent: true,
      mode: "transaction",
      prepareDisabled: true,
    });
    expect(assessPooler("postgres://u:p@aws-0-eu-west-1.pooler.supabase.com:5432/db", {})).toEqual({
      consistent: true,
      mode: "session",
      prepareDisabled: false,
    });
    expect(assessPooler("postgres://u:p@db.ref.supabase.co:5432/db", {})).toEqual({
      consistent: true,
      mode: "direct",
      prepareDisabled: false,
    });
  });

  it("honors pgbouncer=true and the DATABASE_POOLER override", () => {
    expect(assessPooler("postgres://u:p@h:5432/db?pgbouncer=true", {}).mode).toBe("transaction");
    expect(
      assessPooler("postgres://u:p@h:5432/db", { DATABASE_POOLER: "transaction" }),
    ).toMatchObject({ mode: "transaction", prepareDisabled: true });
  });

  it("flags unparseable URLs", () => {
    expect(assessPooler("not a url", {})).toEqual({
      consistent: false,
      mode: "unparseable",
      prepareDisabled: false,
    });
  });
});

describe("supabase-doctor computePendingMigrations", () => {
  it("returns journal tags whose timestamp is not applied", () => {
    const journal = [
      { tag: "0000_init", when: 1000 },
      { tag: "0001_more", when: 2000 },
      { tag: "0002_late", when: 3000 },
    ];
    expect(computePendingMigrations(journal, [1000, 2000])).toEqual(["0002_late"]);
    expect(computePendingMigrations(journal, [1000, 2000, 3000])).toEqual([]);
  });
});

describe("supabase-doctor rlsRiskReport", () => {
  const tables = [
    { owner: "postgres", rls_enabled: false, table_name: "workspace" },
    { owner: "postgres", rls_enabled: true, table_name: "safe_table" },
    { owner: "postgres", rls_enabled: true, table_name: "granted_table" },
  ];
  const grants = [
    { grantee: "anon", privilege_type: "SELECT", table_name: "granted_table" },
    { grantee: "authenticated", privilege_type: "INSERT", table_name: "granted_table" },
  ];

  it("flags RLS-disabled tables and anon/authenticated grants with fix SQL", () => {
    const { fixStatements, risks } = rlsRiskReport({ currentUser: "postgres", grants, tables });
    expect(risks).toHaveLength(2);
    const [workspace, granted] = risks;
    expect(workspace!.table).toBe("workspace");
    expect(workspace!.fixSql).toContain(
      'ALTER TABLE "public"."workspace" ENABLE ROW LEVEL SECURITY;',
    );
    expect(granted!.anonGrants).toEqual(["anon:SELECT", "authenticated:INSERT"]);
    expect(granted!.fixSql).toContain(
      'REVOKE ALL ON "public"."granted_table" FROM anon, authenticated;',
    );
    expect(fixStatements).toHaveLength(2);
  });

  it("warns when the connecting role is not the table owner", () => {
    const { risks } = rlsRiskReport({ currentUser: "app_user", grants: [], tables });
    expect(risks).toHaveLength(1);
    expect(risks[0]!.ownerMismatch).toBe(true);
  });

  it("passes clean schemas", () => {
    const { fixStatements, risks } = rlsRiskReport({
      currentUser: "postgres",
      grants: [],
      tables: [{ owner: "postgres", rls_enabled: true, table_name: "fine" }],
    });
    expect(risks).toEqual([]);
    expect(fixStatements).toEqual([]);
  });
});

describe("supabase-doctor checkStorageEndpoint", () => {
  it("counts any HTTP response as reachable and network errors as failures", async () => {
    const ok = await checkStorageEndpoint(
      "https://x.test",
      async () => new Response(null, { status: 403 }),
    );
    expect(ok).toEqual({ reachable: true, status: 403 });
    const bad = await checkStorageEndpoint("https://x.test", async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(bad.reachable).toBe(false);
    expect(bad.error).toContain("ECONNREFUSED");
  });
});
