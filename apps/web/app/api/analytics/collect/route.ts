import { NextResponse } from "next/server";

import {
  parseAnalyticsCollectBody,
  recordAnalyticsEvent,
  resolveAnalyticsProvider,
} from "../../../../src/analytics";
import { serverObservability } from "../../../../src/observability-runtime";
import { rateLimitResponse } from "../../../../src/rate-limit-route";
import { analyticsCollectLimiter } from "../../../../src/rate-limit-runtime";
import { readBoundedJson, RequestBodyTooLargeError } from "../../../../src/request-body";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RESPONSE_HEADERS = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex",
} as const;

/** Events are tiny (≤ ~1 KB); anything larger is an abuse probe, not a beacon. */
const MAX_COLLECT_BODY_BYTES = 2_048;

/**
 * First-party analytics collect endpoint — only exists under
 * ANALYTICS_PROVIDER=local. Other providers 404 like the route isn't there
 * (the active adapter is never revealed). POST only; sets no cookies and
 * stores no raw IP or user-agent — `recordAnalyticsEvent` folds those into
 * the daily-rotating salted `visitorHash`.
 */
export async function POST(request: Request) {
  if (resolveAnalyticsProvider() !== "local") {
    return NextResponse.json(
      { error: { code: "notFound", message: "Not found." } },
      { headers: RESPONSE_HEADERS, status: 404 },
    );
  }

  const limited = await rateLimitResponse(
    request.headers,
    analyticsCollectLimiter,
    "analytics-collect",
  );
  if (limited !== null) {
    for (const [name, value] of Object.entries(RESPONSE_HEADERS)) {
      limited.headers.set(name, value);
    }
    return limited;
  }

  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_COLLECT_BODY_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return NextResponse.json(
      {
        error: {
          code: tooLarge ? "bodyTooLarge" : "invalidBody",
          message: tooLarge
            ? "The request body is too large."
            : "A valid analytics event is required.",
        },
      },
      { headers: RESPONSE_HEADERS, status: tooLarge ? 413 : 400 },
    );
  }

  const parsed = parseAnalyticsCollectBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        error: { code: "invalidBody", message: "A valid analytics event is required." },
      },
      { headers: RESPONSE_HEADERS, status: 400 },
    );
  }

  try {
    await recordAnalyticsEvent({ ...parsed.event, requestHeaders: request.headers });
  } catch (error) {
    serverObservability.captureException(
      error instanceof Error ? error : new Error("Analytics collect failed."),
      { operation: "analytics.collect", workspaceId: "platform" },
    );
    return NextResponse.json(
      { error: { code: "internalError", message: "The event could not be recorded." } },
      { headers: RESPONSE_HEADERS, status: 500 },
    );
  }

  return new Response(null, { headers: RESPONSE_HEADERS, status: 204 });
}
