import { PUBLIC_CORS, err, ok } from "../../../../../src/supadata/api";
import { resolveRequestSite } from "../../../../../src/supadata/auth";
import { overview, resolveRange } from "../../../../../src/supadata/queries";

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
  return ok(await overview(site.id, range), { headers: PUBLIC_CORS });
}
