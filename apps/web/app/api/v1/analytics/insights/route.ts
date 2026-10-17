import { PUBLIC_CORS, err, ok } from "../../../../../src/supadata/api";
import { resolveRequestSite } from "../../../../../src/supadata/auth";
import {
  mrrSeries,
  resolveRange,
  revenueAttribution,
  revenueSummary,
} from "../../../../../src/supadata/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const site = await resolveRequestSite(url);
  if (!site) return err("Unauthorized or unknown site", 401, { headers: PUBLIC_CORS });
  const range = resolveRange(
    url.searchParams.get("period"),
    url.searchParams.get("from"),
    url.searchParams.get("to"),
  );
  const [summary, byChannel, bySource, byCampaign, mrr] = await Promise.all([
    revenueSummary(site.id, range),
    revenueAttribution(site.id, range, "channel"),
    revenueAttribution(site.id, range, "source"),
    revenueAttribution(site.id, range, "campaign"),
    mrrSeries(site.id, range),
  ]);
  return ok(
    {
      ...summary,
      ltvCents: summary.customers ? Math.round(summary.revenueCents / summary.customers) : 0,
      byChannel,
      bySource,
      byCampaign,
      mrrSeries: mrr,
    },
    { headers: PUBLIC_CORS },
  );
}
