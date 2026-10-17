import { sdAlert, sdAlertEvent } from "@supastack/db";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { database } from "../../../../src/auth-runtime";
import { PUBLIC_CORS, err, ok } from "../../../../src/supadata/api";
import { resolveRequestSite } from "../../../../src/supadata/auth";
import { sdId } from "../../../../src/supadata/id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const site = await resolveRequestSite(url);
  if (!site) return err("Unauthorized or unknown site", 401, { headers: PUBLIC_CORS });
  const alerts = await database.select().from(sdAlert).where(eq(sdAlert.siteId, site.id));
  const recent = alerts.length
    ? await database
        .select()
        .from(sdAlertEvent)
        .where(
          inArray(
            sdAlertEvent.alertId,
            alerts.map((a) => a.id),
          ),
        )
        .orderBy(desc(sdAlertEvent.createdAt))
        .limit(50)
    : [];
  return ok({ alerts, history: recent }, { headers: PUBLIC_CORS });
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  metric: z.enum(["visitors", "pageviews", "revenue", "signups", "goal", "mentions"]),
  condition: z.enum(["gt", "lt"]),
  threshold: z.number(),
  period: z.enum(["hour", "day"]).default("day"),
  target: z.string().max(255).nullish(),
});

export async function POST(request: Request) {
  const url = new URL(request.url);
  const site = await resolveRequestSite(url);
  if (!site) return err("Unauthorized or unknown site", 401, { headers: PUBLIC_CORS });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return err("Invalid payload", 400, { headers: PUBLIC_CORS });
  const [row] = await database
    .insert(sdAlert)
    .values({ id: sdId(), siteId: site.id, ...parsed.data })
    .returning();
  return ok(row, { status: 201, headers: PUBLIC_CORS });
}
