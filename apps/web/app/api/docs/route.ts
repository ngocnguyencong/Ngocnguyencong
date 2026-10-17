import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Scalar API reference UI over the typed OpenAPI document at `/api/v1/openapi`.
 * Matches the demo `/api/docs` surface without duplicating the JSON schema route.
 */
export async function GET() {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>supastack API docs</title>
    <style>
      body { margin: 0; }
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/api/v1/openapi"
      data-configuration='{"theme":"kepler"}'
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
