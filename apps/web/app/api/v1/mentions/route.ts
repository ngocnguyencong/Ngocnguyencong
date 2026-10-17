import { sdMention } from "@supastack/db";
import { z } from "zod";

import { database } from "../../../../src/auth-runtime";
import { PUBLIC_CORS, err, ok } from "../../../../src/supadata/api";
import { resolveRequestSite } from "../../../../src/supadata/auth";
import { sdId } from "../../../../src/supadata/id";
import { mentions, resolveRange } from "../../../../src/supadata/queries";

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
  return ok(await mentions(site.id, range), { headers: PUBLIC_CORS });
}

const createSchema = z.object({
  platform: z.string().min(1).max(32),
  author: z.string().max(120).nullish(),
  text: z.string().min(1),
  url: z.string().url().max(1024).nullish(),
  occurred_at: z.coerce.date().nullish(),
});

export async function POST(request: Request) {
  const url = new URL(request.url);
  const site = await resolveRequestSite(url);
  if (!site) return err("Unauthorized or unknown site", 401, { headers: PUBLIC_CORS });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return err("Invalid payload", 400, { headers: PUBLIC_CORS });
  const b = parsed.data;
  const [row] = await database
    .insert(sdMention)
    .values({
      id: sdId(),
      siteId: site.id,
      platform: b.platform,
      author: b.author ?? null,
      text: b.text,
      url: b.url ?? null,
      occurredAt: b.occurred_at ?? new Date(),
    })
    .returning();
  return ok(row, { status: 201, headers: PUBLIC_CORS });
}
