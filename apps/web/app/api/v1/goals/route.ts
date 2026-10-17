import { sdGoal } from "@supastack/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { database } from "../../../../src/auth-runtime";
import { PUBLIC_CORS, err, ok } from "../../../../src/supadata/api";
import { resolveRequestSite } from "../../../../src/supadata/auth";
import { sdId } from "../../../../src/supadata/id";
import { goalStats, resolveRange } from "../../../../src/supadata/queries";

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
  const [defs, stats] = await Promise.all([
    database.select().from(sdGoal).where(eq(sdGoal.siteId, site.id)),
    goalStats(site.id, range),
  ]);
  const statMap = new Map(stats.map((s) => [s.name, s]));
  return ok(
    defs.map((g) => ({
      id: g.id,
      name: g.name,
      type: g.type,
      value: g.value,
      conversions: Number(statMap.get(g.name)?.total ?? 0),
      visitors: Number(statMap.get(g.name)?.visitors ?? 0),
    })),
    { headers: PUBLIC_CORS },
  );
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["pageview", "event"]),
  value: z.string().min(1).max(512),
});

export async function POST(request: Request) {
  const url = new URL(request.url);
  const site = await resolveRequestSite(url);
  if (!site) return err("Unauthorized or unknown site", 401, { headers: PUBLIC_CORS });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return err("Invalid payload", 400, { headers: PUBLIC_CORS });
  const [row] = await database
    .insert(sdGoal)
    .values({ id: sdId(), siteId: site.id, ...parsed.data })
    .returning();
  return ok(row, { status: 201, headers: PUBLIC_CORS });
}
