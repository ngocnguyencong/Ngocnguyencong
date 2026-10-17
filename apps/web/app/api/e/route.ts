import { processEvent } from "../../../src/supadata/ingest";
import { PUBLIC_CORS, err, ok } from "../../../src/supadata/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tracker ingest — same contract as POST /api/v1/collect. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON", 400, { headers: PUBLIC_CORS });
  }
  const result = await processEvent(body, request.headers);
  if (!result.ok) return err(result.message, result.code, { headers: PUBLIC_CORS });
  return ok({ tracked: !result.deduped }, { headers: PUBLIC_CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_CORS });
}
