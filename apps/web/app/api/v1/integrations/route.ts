import { sdIntegration } from "@supastack/db";
import { and, eq } from "drizzle-orm";
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
  const rows = await database.select().from(sdIntegration).where(eq(sdIntegration.siteId, site.id));
  return ok(rows, { headers: PUBLIC_CORS });
}

const upsertSchema = z.object({
  provider: z.string().min(1).max(32),
  status: z.enum(["connected", "disconnected"]).default("connected"),
  meta: z.record(z.string(), z.unknown()).nullish(),
});

export async function POST(request: Request) {
  const url = new URL(request.url);
  const site = await resolveRequestSite(url);
  if (!site) return err("Unauthorized or unknown site", 401, { headers: PUBLIC_CORS });
  const parsed = upsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return err("Invalid payload", 400, { headers: PUBLIC_CORS });
  const b = parsed.data;
  const [existing] = await database
    .select()
    .from(sdIntegration)
    .where(and(eq(sdIntegration.siteId, site.id), eq(sdIntegration.provider, b.provider)))
    .limit(1);
  if (existing) {
    const [row] = await database
      .update(sdIntegration)
      .set({ status: b.status, meta: b.meta ? JSON.stringify(b.meta) : existing.meta })
      .where(eq(sdIntegration.id, existing.id))
      .returning();
    return ok(row, { headers: PUBLIC_CORS });
  }
  const [row] = await database
    .insert(sdIntegration)
    .values({
      id: sdId(),
      siteId: site.id,
      provider: b.provider,
      status: b.status,
      meta: b.meta ? JSON.stringify(b.meta) : null,
    })
    .returning();
  return ok(row, { status: 201, headers: PUBLIC_CORS });
}
