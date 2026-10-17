#!/usr/bin/env node
/**
 * Diagnose a Supabase (cloud or self-hosted) database for this kit.
 *
 *   pnpm supabase:doctor [-- --fix-rls]
 *
 * Reads DATABASE_URL and optional STORAGE_ENDPOINT / DATABASE_POOLER.
 * Reports server version, SSL, pooler mode vs prepared statements, pending
 * Drizzle migrations, and kit tables in `public` that Supabase's PostgREST
 * would expose (RLS disabled, or grants to anon/authenticated) with exact
 * fix SQL. --fix-rls applies the fixes in one transaction. Exits non-zero
 * on failures. Pure helpers are exported for offline tests.
 */
import { error, log } from "node:console";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

const { fetch } = globalThis;

const require = createRequire(new URL("../packages/db/package.json", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const JOURNAL_PATH = `${repoRoot}packages/db/drizzle/meta/_journal.json`;

export function parseArgs(argv) {
  return { fixRls: argv.includes("--fix-rls") };
}

/**
 * Pooler assessment. Transaction poolers cannot hold prepared statements —
 * the kit's postgresClientOptions disables `prepare` for the same signals
 * checked here, so the doctor verifies the URL and driver agree.
 */
export function assessPooler(databaseUrl, environment = {}) {
  let mode = "direct";
  try {
    const url = new URL(databaseUrl);
    if (url.port === "6543" || url.searchParams.get("pgbouncer") === "true") {
      mode = "transaction";
    } else if (url.hostname.endsWith("pooler.supabase.com") || url.hostname.includes("pooler")) {
      mode = "session";
    }
  } catch {
    return { consistent: false, mode: "unparseable", prepareDisabled: false };
  }
  if (environment.DATABASE_POOLER === "transaction") {
    mode = "transaction";
  } else if (environment.DATABASE_POOLER === "session" && mode === "transaction") {
    // Explicit env override wins only when the URL does not demand transaction.
    return { consistent: false, mode: "transaction", prepareDisabled: true };
  }
  const prepareDisabled = mode === "transaction";
  return { consistent: true, mode, prepareDisabled };
}

/** Drizzle journal tags not yet present in `drizzle.__drizzle_migrations`. */
export function computePendingMigrations(journalEntries, appliedCreatedAts) {
  const applied = new Set(appliedCreatedAts.map((value) => Number(value)));
  return journalEntries.filter((entry) => !applied.has(Number(entry.when))).map((e) => e.tag);
}

const quoteIdent = (name) => `"${name.replaceAll('"', '""')}"`;

/**
 * Tables in an API-exposed schema that PostgREST could reach: RLS disabled,
 * or explicit grants to anon/authenticated. Returns risks with fix SQL and
 * the flat statement list used by --fix-rls.
 */
export function rlsRiskReport({ currentUser, grants, schema = "public", tables }) {
  const grantsByTable = new Map();
  for (const grant of grants) {
    const list = grantsByTable.get(grant.table_name) ?? [];
    list.push(`${grant.grantee}:${grant.privilege_type}`);
    grantsByTable.set(grant.table_name, list);
  }

  const risks = [];
  const fixStatements = [];
  for (const table of tables) {
    const anonGrants = grantsByTable.get(table.table_name) ?? [];
    const rlsDisabled = !table.rls_enabled;
    if (!rlsDisabled && anonGrants.length === 0) {
      continue;
    }
    const qualified = `${quoteIdent(schema)}.${quoteIdent(table.table_name)}`;
    const fixes = [];
    if (rlsDisabled) {
      fixes.push(`ALTER TABLE ${qualified} ENABLE ROW LEVEL SECURITY;`);
    }
    if (anonGrants.length > 0) {
      fixes.push(`REVOKE ALL ON ${qualified} FROM anon, authenticated;`);
    }
    fixStatements.push(...fixes);
    risks.push({
      anonGrants,
      fixSql: fixes.join("\n"),
      ownerMismatch: table.owner !== currentUser,
      table: table.table_name,
    });
  }
  return { fixStatements, risks };
}

/** STORAGE_ENDPOINT must answer any HTTP response to count as reachable. */
export async function checkStorageEndpoint(endpoint, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(endpoint, { method: "GET" });
    return { reachable: true, status: response.status };
  } catch (err) {
    return { error: String(err?.message ?? err), reachable: false, status: null };
  }
}

async function main() {
  const { fixRls } = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    error("DATABASE_URL is required.");
    process.exitCode = 1;
    return;
  }

  const postgres = require("postgres");
  const pooler = assessPooler(databaseUrl, process.env);
  const options = pooler.prepareDisabled ? { max: 1, prepare: false } : { max: 1 };
  const sql = postgres(databaseUrl, options);

  let failures = 0;
  const fail = (message) => {
    failures += 1;
    error(`  FAIL  ${message}`);
  };

  try {
    const [{ version }] = await sql`select version() as version`;
    log(`Server:    ${version.split(" ").slice(0, 2).join(" ")}`);

    const sslRows = await sql`
      select ssl, version as tls_version from pg_stat_ssl where pid = pg_backend_pid()`;
    const ssl = sslRows[0];
    log(
      ssl?.ssl
        ? `SSL:       on (${ssl.tls_version ?? "TLS"})`
        : "SSL:       off — fine on a private network, required over the public internet",
    );

    const [{ current_user: currentUser }] = await sql`select current_user`;
    log(`Role:      ${currentUser}`);
    log(
      `Pooler:    ${pooler.mode}${pooler.prepareDisabled ? " (prepared statements disabled — correct)" : ""}`,
    );
    if (!pooler.consistent) {
      error("  WARN  pooler URL and DATABASE_POOLER disagree — check connection settings");
    }

    // Drizzle migration state.
    const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8"));
    let applied = [];
    try {
      applied = await sql`select created_at from drizzle.__drizzle_migrations`;
    } catch {
      log("Migrations: drizzle.__drizzle_migrations missing — none applied yet");
    }
    const pending = computePendingMigrations(
      journal.entries ?? [],
      applied.map((r) => r.created_at),
    );
    log(
      pending.length === 0
        ? `Migrations: ${applied.length} applied, none pending`
        : `Migrations: ${applied.length} applied, ${pending.length} PENDING (${pending.join(", ")}) — run pnpm --filter @supastack/db db:migrate`,
    );

    // RLS / grants exposure in the API-served schema.
    const tables = await sql`
      select c.relname as table_name, c.relrowsecurity as rls_enabled,
             pg_get_userbyid(c.relowner) as owner
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname`;
    const grants = await sql`
      select table_name, grantee, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated')`;
    const { fixStatements, risks } = rlsRiskReport({ currentUser, grants, tables });

    if (risks.length === 0) {
      log("RLS:       all public tables hardened (RLS on, no anon/authenticated grants)");
    } else {
      for (const risk of risks) {
        fail(
          `public.${risk.table} exposed to PostgREST` +
            `${risk.anonGrants.length ? ` (grants: ${risk.anonGrants.join(", ")})` : ""}\n` +
            `         fix: ${risk.fixSql.replaceAll("\n", " ")}`,
        );
        if (risk.ownerMismatch) {
          error(
            `  WARN  ${currentUser} does not own ${risk.table} — enabling RLS without policies can block the app if the app role is not the owner`,
          );
        }
      }
      if (fixRls) {
        log(`\nApplying ${fixStatements.length} RLS fixes in one transaction…`);
        await sql.begin(async (tx) => {
          for (const statement of fixStatements) {
            await tx.unsafe(statement);
          }
        });
        log("  done — re-run the doctor to confirm");
      } else {
        log("\nRe-run with --fix-rls to apply the ALTER/REVOKE statements in a transaction.");
      }
    }

    // Storage endpoint reachability.
    if (process.env.STORAGE_ENDPOINT) {
      const storage = await checkStorageEndpoint(process.env.STORAGE_ENDPOINT);
      if (storage.reachable) {
        log(`Storage:   reachable (HTTP ${storage.status})`);
      } else {
        fail(`Storage endpoint ${process.env.STORAGE_ENDPOINT} unreachable: ${storage.error}`);
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  if (failures > 0) {
    error(`\n${failures} check(s) failed.`);
    process.exitCode = 1;
  } else {
    log("\nAll checks passed.");
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    error(`supabase:doctor failed: ${err.message}`);
    process.exitCode = 1;
  });
}
