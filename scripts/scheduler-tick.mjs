#!/usr/bin/env node
/**
 * Trigger one scheduler tick against a running app — the local/dev/CI driver
 * for `job_schedule` when Trigger.dev isn't in play.
 *
 *   pnpm jobs:tick
 *
 * Reads SCHEDULER_TICK_SECRET (+ optional APP_URL / SCHEDULER_TICK_URL for the
 * base URL) from the environment, falling back to the repo-root `.env`.
 * Exits non-zero on a non-2xx response.
 */
import { error, log } from "node:console";
import { existsSync } from "node:fs";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const { AbortSignal, fetch } = globalThis;

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envPath)) {
  try {
    // loadEnvFile never overrides variables already set in the environment.
    process.loadEnvFile(envPath);
  } catch (envError) {
    // A malformed .env shouldn't kill the tick — exported vars still work.
    error(
      `Could not load ${envPath}: ${
        envError instanceof Error ? envError.message : envError
      } — falling back to the process environment.`,
    );
  }
}

const secret = process.env.SCHEDULER_TICK_SECRET;
if (!secret) {
  error("SCHEDULER_TICK_SECRET is required — the tick endpoint stays disabled without it.");
  process.exitCode = 1;
} else {
  const base = (
    process.env.SCHEDULER_TICK_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");

  try {
    const response = await fetch(`${base}/api/internal/scheduler-tick`, {
      headers: { "x-scheduler-key": secret },
      method: "POST",
      // The tick itself may take a while (handlers get 60s each server-side),
      // but a wedged connection must not hang this script forever.
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.text();
    log(`POST ${base}/api/internal/scheduler-tick → ${response.status} ${body}`);
    if (!response.ok) {
      process.exitCode = 1;
    }
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    error(
      timedOut
        ? "Scheduler tick request timed out after 30s."
        : `Scheduler tick request failed: ${err instanceof Error ? err.message : err}`,
    );
    process.exitCode = 1;
  }
}
