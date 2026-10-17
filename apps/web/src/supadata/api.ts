export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ status: "ok", data }, init);
}

export function err(message: string, code = 400, init?: ResponseInit): Response {
  return Response.json({ status: "error", error: { code, message } }, { status: code, ...init });
}

/** CORS headers for public ingest + v1 reads (tracker runs cross-origin). */
export const PUBLIC_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
} as const;
