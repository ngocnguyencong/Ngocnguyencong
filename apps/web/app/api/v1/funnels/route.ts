import { sdFunnel } from "@supastack/db";
import { eq } from "drizzle-orm";
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
  const rows = await database.select().from(sdFunnel).where(eq(sdFunnel.siteId, site.id));
  return ok(
    rows.map((f) => ({ id: f.id, name: f.name, steps: JSON.parse(f.steps) as unknown })),
    { headers: PUBLIC_CORS },
  );
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  steps: z
    .array(z.object({ type: z.enum(["pageview", "event"]), value: z.string().min(1).max(512) }))
    .min(2)
    .max(8),
});

export async function POST(request: Request) {
  const url = new URL(request.url);
  const site = await resolveRequestSite(url);
  if (!site) return err("Unauthorized or unknown site", 401, { headers: PUBLIC_CORS });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return err("Invalid payload (2-8 steps required)", 400, { headers: PUBLIC_CORS });
  const [row] = await database
    .insert(sdFunnel)
    .values({
      id: sdId(),
      siteId: site.id,
      name: parsed.data.name,
      steps: JSON.stringify(parsed.data.steps),
    })
    .returning();
  return ok({ ...row, steps: parsed.data.steps }, { status: 201, headers: PUBLIC_CORS });
}
