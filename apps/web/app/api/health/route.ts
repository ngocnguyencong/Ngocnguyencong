import { getHealthSnapshot } from "../../../src/health-snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Dependency health probe. Reports provider *configuration* kinds plus the
 * checks actually probed — secrets are never included in the payload.
 */
export async function GET() {
  const snapshot = await getHealthSnapshot();
  return Response.json(snapshot, { status: snapshot.status === "ok" ? 200 : 503 });
}
