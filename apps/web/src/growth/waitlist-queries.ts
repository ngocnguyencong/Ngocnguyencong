import "server-only";

import { database } from "../auth-runtime";
import { requireAdminSession } from "../admin-actions";
import { createGrowthStore } from "./growth-store";
import type { WaitlistEntryRow } from "./early-access";

const growthStore = createGrowthStore(database);

/** Platform-admin list of waitlist entries, referral count first. */
export async function listWaitlistEntries(limit = 500): Promise<WaitlistEntryRow[]> {
  await requireAdminSession();
  return growthStore.listWaitlistEntries({ limit, order: "referral" });
}
