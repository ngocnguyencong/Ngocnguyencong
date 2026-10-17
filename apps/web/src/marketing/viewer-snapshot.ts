import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { getAuthSession } from "../auth-runtime";
import type { ViewerSnapshot } from "./viewer-snapshot-types";

/**
 * Per-request viewer identity for the marketing header — seeds the SSR output
 * so the account action never pops in after hydration. `undefined` means the
 * resolution failed or ran outside a request scope; the client session check
 * then keeps owning the state exactly as before.
 */
export const getViewerSnapshot = cache(async (): Promise<ViewerSnapshot | undefined> => {
  try {
    const session = await getAuthSession(await headers());
    return { signedIn: session !== null };
  } catch {
    return undefined;
  }
});
