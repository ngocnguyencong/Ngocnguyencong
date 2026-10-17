#!/usr/bin/env node
/**
 * Provision a Supabase Cloud project for this kit through the Management API.
 *
 *   pnpm supabase:provision -- --org <slug> --name <name> --region <region> \
 *     [--plan <plan>] [--write-env] [--force] [--migrate] [--yes]
 *
 * Without --yes this is a dry run that prints the plan only — creating a
 * project can be billable. SUPABASE_ACCESS_TOKEN must be a Management API
 * token (https://supabase.com/dashboard/account/tokens) with projects:write.
 * The token and generated database password are never printed; .env values
 * are never overwritten without --force.
 */
import { spawnSync } from "node:child_process";
import { error, log } from "node:console";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL, URL } from "node:url";

const { fetch } = globalThis;

export const SUPABASE_API_BASE = "https://api.supabase.com";
const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

export function parseArgs(argv) {
  const args = {
    force: false,
    migrate: false,
    name: undefined,
    org: undefined,
    plan: undefined,
    region: undefined,
    writeEnv: false,
    yes: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--org":
        args.org = argv[++index];
        break;
      case "--name":
        args.name = argv[++index];
        break;
      case "--region":
        args.region = argv[++index];
        break;
      case "--plan":
        args.plan = argv[++index];
        break;
      case "--write-env":
        args.writeEnv = true;
        break;
      case "--force":
        args.force = true;
        break;
      case "--migrate":
        args.migrate = true;
        break;
      case "--yes":
        args.yes = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  for (const key of ["org", "name", "region"]) {
    if (!args[key]) {
      throw new Error(`Missing required --${key}`);
    }
  }
  return args;
}

/** Strong random password; printed nowhere, stored only in .env on request. */
export function generateDbPassword() {
  return randomBytes(24).toString("base64url");
}

/**
 * Supabase pooler/Direct connection strings for a project ref + region.
 * Session mode (5432) supports prepared statements — use it for migrations
 * and long-lived processes. Transaction mode (6543) is for serverless
 * functions; the kit's postgresClientOptions disables `prepare` there.
 */
export function buildConnectionStrings({ ref, region, password }) {
  const encoded = encodeURIComponent(password);
  const poolerHost = `aws-0-${region}.pooler.supabase.com`;
  return {
    direct: `postgres://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres?sslmode=require`,
    sessionPooler: `postgres://postgres.${ref}:${encoded}@${poolerHost}:5432/postgres?sslmode=require`,
    transactionPooler: `postgres://postgres.${ref}:${encoded}@${poolerHost}:6543/postgres?sslmode=require&pgbouncer=true`,
  };
}

/** Replace the password in a postgres URL for safe display. */
export function maskDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "****";
    }
    return parsed.toString();
  } catch {
    return url.replace(/:[^:@/]+@/, ":****@");
  }
}

/**
 * Merge additions into dotenv content. Existing keys are kept unless
 * force=true; returns the new content plus which keys were applied/skipped.
 */
export function mergeEnv(existing, additions, { force = false } = {}) {
  const lines = existing.split(/\r?\n/);
  const applied = [];
  const skipped = [];
  const remaining = new Map(Object.entries(additions));
  const merged = lines.map((line) => {
    const match = /^([A-Z0-9_]+)=/.exec(line);
    if (!match || !remaining.has(match[1])) {
      return line;
    }
    const key = match[1];
    const value = remaining.get(key);
    remaining.delete(key);
    const current = line.slice(line.indexOf("=") + 1).trim();
    if (current !== "" && !force) {
      skipped.push(key);
      return line;
    }
    applied.push(key);
    return `${key}=${value}`;
  });
  for (const [key, value] of remaining) {
    applied.push(key);
    merged.push(`${key}=${value}`);
  }
  return { applied, content: merged.join("\n"), skipped };
}

async function managementApi(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${SUPABASE_API_BASE}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Management API ${method} ${path} failed (${response.status}): ${text.slice(0, 300)}`,
    );
  }
  return text === "" ? null : JSON.parse(text);
}

async function waitForHealthy({ ref, token }) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let lastStatus = "UNKNOWN";
  while (Date.now() < deadline) {
    const project = await managementApi(`/v1/projects/${ref}`, { token });
    lastStatus = project?.status ?? "UNKNOWN";
    if (lastStatus === "ACTIVE_HEALTHY") {
      return;
    }
    if (lastStatus === "INACTIVE" || lastStatus === "REMOVED") {
      throw new Error(`Project ${ref} entered unexpected status ${lastStatus}`);
    }
    log(`  project status: ${lastStatus} — waiting…`);
    await setTimeout(POLL_INTERVAL_MS);
  }
  throw new Error(
    `Timed out waiting for project ${ref} to become ACTIVE_HEALTHY (last: ${lastStatus})`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is required (https://supabase.com/dashboard/account/tokens)",
    );
  }

  log("Supabase project plan:");
  log(`  organization: ${args.org}`);
  log(`  name:         ${args.name}`);
  log(`  region:       ${args.region}`);
  log(`  plan:         ${args.plan ?? "platform default (usually free)"}`);
  log(`  write .env:   ${args.writeEnv}${args.force ? " (overwrite allowed)" : ""}`);
  log(`  run migrate:  ${args.migrate}`);

  if (!args.yes) {
    log(
      "\nDry run — pass --yes to create the project. Creating a project can be billable depending on the plan.",
    );
    return;
  }

  log("\nCreating project…");
  const password = generateDbPassword();
  const project = await managementApi("/v1/projects", {
    body: {
      db_pass: password,
      db_region: args.region,
      name: args.name,
      organization_slug: args.org,
      ...(args.plan ? { plan: args.plan } : {}),
    },
    method: "POST",
    token,
  });
  const ref = project.ref;
  log(`  project ref: ${ref} — waiting for ACTIVE_HEALTHY`);
  await waitForHealthy({ ref, token });

  const urls = buildConnectionStrings({ ref, region: args.region, password });
  const storageEndpoint = `https://${ref}.supabase.co/storage/v1/s3`;

  log("\nConnection strings (password masked):");
  log(`  session pooler (migrations, long-lived):  ${maskDatabaseUrl(urls.sessionPooler)}`);
  log(`  transaction pooler (serverless):        ${maskDatabaseUrl(urls.transactionPooler)}`);
  log(`  direct (5432):                          ${maskDatabaseUrl(urls.direct)}`);
  log(`\nStorage S3 endpoint: ${storageEndpoint} (region ${args.region})`);
  log("Create S3 access keys in Dashboard → Storage → S3 connection settings,");
  log("then set STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY / STORAGE_BUCKET.");

  if (args.writeEnv) {
    const envPath = resolve(process.cwd(), ".env");
    const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
    const { applied, content, skipped } = mergeEnv(
      existing,
      {
        DATABASE_URL: urls.sessionPooler,
        DATABASE_URL_TRANSACTION: urls.transactionPooler,
        STORAGE_ENDPOINT: storageEndpoint,
        STORAGE_REGION: args.region,
      },
      { force: args.force },
    );
    writeFileSync(envPath, content.endsWith("\n") ? content : `${content}\n`);
    log(
      `\nWrote ${envPath}: applied [${applied.join(", ") || "none"}]` +
        (skipped.length
          ? `; kept existing [${skipped.join(", ")}] (use --force to overwrite)`
          : ""),
    );
  }

  if (args.migrate) {
    log("\nRunning migrations against the session pooler…");
    const result = spawnSync("pnpm", ["--filter", "@supastack/db", "db:migrate"], {
      env: { ...process.env, DATABASE_URL: urls.sessionPooler },
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error("db:migrate failed — run pnpm supabase:doctor to diagnose.");
    }
  }

  log("\nDone. Keep the password safe — it was written only to .env (if requested).");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    error(`supabase:provision failed: ${err.message}`);
    process.exitCode = 1;
  });
}
