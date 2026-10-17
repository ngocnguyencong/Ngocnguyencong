import { PUBLIC_CORS, err, ok } from "../../../../../src/supadata/api";
import { resolveRequestSite } from "../../../../../src/supadata/auth";
import { visitorDetail } from "../../../../../src/supadata/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const site = await resolveRequestSite(url);
  if (!site) return err("Unauthorized or unknown site", 401, { headers: PUBLIC_CORS });
  const detail = await visitorDetail(site.id, id);
  if (!detail) return err("Visitor not found", 404, { headers: PUBLIC_CORS });
  return ok(detail, { headers: PUBLIC_CORS });
}
