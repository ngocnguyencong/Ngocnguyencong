import { PUBLIC_CORS, err, ok } from "../../../../../src/supadata/api";
import { resolveRequestSite } from "../../../../../src/supadata/auth";
import { breakdown, resolveRange } from "../../../../../src/supadata/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/analytics/{page|referrer|source|channel|medium|campaign|country|region|city|device|browser|os|hostname|event|goal} */
export async function GET(request: Request, context: { params: Promise<{ dimension: string }> }) {
  const { dimension } = await context.params;
  const url = new URL(request.url);
  const site = await resolveRequestSite(url);
  if (!site) return err("Unauthorized or unknown site", 401, { headers: PUBLIC_CORS });
  const range = resolveRange(
    url.searchParams.get("period"),
    url.searchParams.get("from"),
    url.searchParams.get("to"),
  );
  const rows = await breakdown(
    site.id,
    range,
    dimension,
    Number(url.searchParams.get("limit") ?? 100),
  );
  if (!rows) return err(`Unknown dimension: ${dimension}`, 400, { headers: PUBLIC_CORS });
  return ok(rows, { headers: PUBLIC_CORS });
}
