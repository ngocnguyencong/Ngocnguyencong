import { buildLlmsTxt } from "../../src/marketing/llms-txt";
import { siteOrigin } from "../../src/marketing/seo";

// Every emitted link is absolute — resolve siteOrigin() per request, not at
// build time where APP_URL is unset and the origin would bake to
// localhost:3000. Same contract as robots.ts and sitemap.ts.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(buildLlmsTxt(siteOrigin()), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
