import { PUBLIC_CORS, err, ok } from "../../../../src/supadata/api";
import { resolveRequestSite } from "../../../../src/supadata/auth";
import { resolveRange, visitors } from "../../../../src/supadata/queries";

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
  const result = await visitors(site.id, range, {
    search: url.searchParams.get("search") ?? undefined,
    limit: Number(url.searchParams.get("limit") ?? 50),
    offset: Number(url.searchParams.get("offset") ?? 0),
  });
  return ok(result, { headers: PUBLIC_CORS });
}
