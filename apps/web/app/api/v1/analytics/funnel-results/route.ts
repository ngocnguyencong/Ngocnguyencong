import { sdFunnel } from "@supastack/db";
import { and, eq } from "drizzle-orm";

import { database } from "../../../../../src/auth-runtime";
import { PUBLIC_CORS, err, ok } from "../../../../../src/supadata/api";
import { resolveRequestSite } from "../../../../../src/supadata/auth";
import {
  funnelResults,
  resolveRange,
  type FunnelStepSpec,
} from "../../../../../src/supadata/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/analytics/funnel-results?funnel_id=… or ?steps=[{"type","value"}] */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const site = await resolveRequestSite(url);
  if (!site) return err("Unauthorized or unknown site", 401, { headers: PUBLIC_CORS });
  const range = resolveRange(
    url.searchParams.get("period"),
    url.searchParams.get("from"),
    url.searchParams.get("to"),
  );

  let steps: FunnelStepSpec[] = [];
  const funnelId = url.searchParams.get("funnel_id");
  const stepsParam = url.searchParams.get("steps");
  if (funnelId) {
    const [f] = await database
      .select()
      .from(sdFunnel)
      .where(and(eq(sdFunnel.id, funnelId), eq(sdFunnel.siteId, site.id)))
      .limit(1);
    if (!f) return err("Unknown funnel", 404, { headers: PUBLIC_CORS });
    steps = JSON.parse(f.steps) as FunnelStepSpec[];
  } else if (stepsParam) {
    try {
      steps = JSON.parse(stepsParam) as FunnelStepSpec[];
    } catch {
      return err("Invalid steps JSON", 400, { headers: PUBLIC_CORS });
    }
  } else {
    return err("funnel_id or steps required", 400, { headers: PUBLIC_CORS });
  }
  return ok(await funnelResults(site.id, range, steps), { headers: PUBLIC_CORS });
}
