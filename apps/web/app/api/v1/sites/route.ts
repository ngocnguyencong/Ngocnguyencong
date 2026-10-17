import { sdSite, sdSiteKey } from "@supastack/db";
import { z } from "zod";

import { database } from "../../../../src/auth-runtime";
import { PUBLIC_CORS, err, ok } from "../../../../src/supadata/api";
import { listWorkspaceSites, resolveCallerWorkspace } from "../../../../src/supadata/auth";
import { sdId, sdShareId, sdSiteId, newSiteKey } from "../../../../src/supadata/id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Workspace-scoped site admin — requires sk_* key or session (not a site key). */
export async function GET() {
  const workspaceId = await resolveCallerWorkspace();
  if (!workspaceId) return err("Unauthorized", 401, { headers: PUBLIC_CORS });
  const sites = await listWorkspaceSites(workspaceId);
  return ok(
    sites.map((s) => ({
      id: s.id,
      domain: s.domain,
      name: s.name,
      timezone: s.timezone,
      shareId: s.shareId,
      cookieless: s.cookieless,
      createdAt: s.createdAt,
    })),
    { headers: PUBLIC_CORS },
  );
}

const createSchema = z.object({
  domain: z.string().min(1).max(255),
  name: z.string().max(255).nullish(),
  timezone: z.string().max(64).default("UTC"),
  cookieless: z.boolean().default(false),
});

export async function POST(request: Request) {
  const workspaceId = await resolveCallerWorkspace();
  if (!workspaceId) return err("Unauthorized", 401, { headers: PUBLIC_CORS });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return err("Invalid payload", 400, { headers: PUBLIC_CORS });
  const id = sdSiteId();
  const shareId = sdShareId();
  const [site] = await database
    .insert(sdSite)
    .values({
      id,
      workspaceId,
      domain: parsed.data.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
      name: parsed.data.name ?? parsed.data.domain,
      timezone: parsed.data.timezone,
      shareId,
      cookieless: parsed.data.cookieless,
    })
    .returning();
  // Every site gets a default tracking key so `sd_*` works out of the box.
  const key = newSiteKey();
  await database
    .insert(sdSiteKey)
    .values({ id: sdId(), siteId: id, name: "default", prefix: key.prefix, keyHash: key.hash });
  return ok({ ...site, apiKey: key.key }, { status: 201, headers: PUBLIC_CORS });
}
