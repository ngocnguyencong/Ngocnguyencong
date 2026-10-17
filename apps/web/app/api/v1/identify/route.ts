import { sdVisitor } from "@supastack/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { database } from "../../../../src/auth-runtime";
import { PUBLIC_CORS, err, ok } from "../../../../src/supadata/api";
import { resolveRequestSite } from "../../../../src/supadata/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  visitor_id: z.string().min(1),
  user_id: z.string().max(128).nullish(),
  email: z.string().email().max(255).nullish(),
  name: z.string().max(255).nullish(),
  image: z.string().max(2048).nullish(),
});

/** POST /api/v1/identify — attach customer identity to a tracked visitor. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const site = await resolveRequestSite(url);
  if (!site) return err("Unauthorized or unknown site", 401, { headers: PUBLIC_CORS });
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return err("Invalid JSON", 400, { headers: PUBLIC_CORS });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return err("Invalid payload", 400, { headers: PUBLIC_CORS });
  const b = parsed.data;
  const [v] = await database
    .select()
    .from(sdVisitor)
    .where(and(eq(sdVisitor.siteId, site.id), eq(sdVisitor.visitorKey, b.visitor_id)))
    .limit(1);
  if (!v) return err("Visitor not found", 404, { headers: PUBLIC_CORS });
  await database
    .update(sdVisitor)
    .set({
      userId: b.user_id ?? v.userId,
      email: b.email ?? v.email,
      name: b.name ?? v.name,
      image: b.image ?? v.image,
      updatedAt: new Date(),
    })
    .where(eq(sdVisitor.id, v.id));
  return ok({ identified: true });
}
