import { timingSafeEqual } from "node:crypto";

import { parseServerConfig } from "@supastack/config";
import { NextResponse } from "next/server";

import { serverObservability } from "../../../../src/observability-runtime";
import { rateLimitResponse } from "../../../../src/rate-limit-route";
import { schedulerTickLimiter } from "../../../../src/rate-limit-runtime";
import { tickScheduler } from "../../../../src/scheduler-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const serverConfig = parseServerConfig();

const RESPONSE_HEADERS = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex",
} as const;

/**
 * Internal scheduler tick — the local/dev/CI driver for `job_schedule` when
 * Trigger.dev isn't running the tick. Disabled unless SCHEDULER_TICK_SECRET
 * is configured: with no secret the endpoint 404s like it doesn't exist.
 *
 *   curl -X POST -H "x-scheduler-key: $SCHEDULER_TICK_SECRET" \
 *     localhost:3000/api/internal/scheduler-tick
 *
 * Optional JSON body: `{dryRun?: boolean, limit?: number ≤ 100}` — `dryRun`
 * previews the due set without seeding, advancing, or dispatching anything.
 */
export async function POST(request: Request) {
  const secret = serverConfig.scheduler.tickSecret;
  if (secret === undefined) {
    return NextResponse.json(
      { error: { code: "notFound", message: "Not found." } },
      { headers: RESPONSE_HEADERS, status: 404 },
    );
  }

  const limited = await rateLimitResponse(request.headers, schedulerTickLimiter, "scheduler-tick");
  if (limited !== null) {
    // The shared 429 helper only sets rate-limit headers — keep the same
    // no-store/noindex markers every other response from this route carries.
    for (const [name, value] of Object.entries(RESPONSE_HEADERS)) {
      limited.headers.set(name, value);
    }
    return limited;
  }

  if (!schedulerKeyMatches(request.headers.get("x-scheduler-key"), secret)) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "A valid scheduler key is required." } },
      { headers: RESPONSE_HEADERS, status: 401 },
    );
  }

  const body = await parseTickBody(request);
  if (body === null) {
    return NextResponse.json(
      {
        error: {
          code: "invalidBody",
          message: 'Body must be a JSON object like {"dryRun":true,"limit":10}.',
        },
      },
      { headers: RESPONSE_HEADERS, status: 400 },
    );
  }

  try {
    const result = await tickScheduler(body);
    return NextResponse.json(result, { headers: RESPONSE_HEADERS });
  } catch (error) {
    serverObservability.captureException(
      error instanceof Error ? error : new Error("Scheduler tick failed."),
      { operation: "scheduler.tick", workspaceId: "platform" },
    );
    return NextResponse.json(
      { error: { code: "internalError", message: "The scheduler tick could not be completed." } },
      { headers: RESPONSE_HEADERS, status: 500 },
    );
  }
}

function schedulerKeyMatches(candidate: string | null, secret: string): boolean {
  if (candidate === null) {
    return false;
  }
  const candidateBuffer = Buffer.from(candidate);
  const secretBuffer = Buffer.from(secret);
  return (
    candidateBuffer.length === secretBuffer.length && timingSafeEqual(candidateBuffer, secretBuffer)
  );
}

const MAX_TICK_LIMIT = 100;

/**
 * Optional `{dryRun?, limit?}` body — `limit` is capped tighter than the
 * claim layer's own 500 because this endpoint is the operator-facing knob.
 * Returns null on anything malformed; unknown keys are ignored.
 */
async function parseTickBody(
  request: Request,
): Promise<{ dryRun?: boolean; limit?: number } | null> {
  const text = await request.text();
  if (text.trim().length === 0) {
    return {};
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const { dryRun, limit } = value as Record<string, unknown>;
  if (dryRun !== undefined && typeof dryRun !== "boolean") {
    return null;
  }
  if (
    limit !== undefined &&
    (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > MAX_TICK_LIMIT)
  ) {
    return null;
  }
  return {
    ...(dryRun === undefined ? {} : { dryRun }),
    ...(limit === undefined ? {} : { limit }),
  };
}
