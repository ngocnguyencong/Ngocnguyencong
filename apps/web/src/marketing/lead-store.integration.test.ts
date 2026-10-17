import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getLeadStore } from "./lead-store";

/**
 * Real-Firestore lane: runs only when FIREBASE_PROJECT_ID,
 * FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are set (same convention as
 * packages/db postgres.integration.test.ts). Uses a unique probe email and
 * deletes every doc it creates in afterEach.
 */
const hasFirebaseEnv = Boolean(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY,
);
const integrationIt = hasFirebaseEnv ? it : it.skip;

const probeEmail = `lead-itest-${Date.now()}@example.com`;

async function deleteProbeDocs(): Promise<void> {
  const { getApps, initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app =
    getApps().length > 0
      ? getApps()[0]!
      : initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID!,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
            privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
          }),
          projectId: process.env.FIREBASE_PROJECT_ID!,
        });
  const databaseId = process.env.FIRESTORE_DATABASE?.trim() || "(default)";
  const db = databaseId === "(default)" ? getFirestore(app) : getFirestore(app, databaseId);
  const snapshot = await db.collection("marketing_leads").where("email", "==", probeEmail).get();
  await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
}

describe("firestore lead store (real)", () => {
  integrationIt(
    "writes a newsletter lead, dedupes it, then cleans up",
    async () => {
      vi.stubEnv("MARKETING_LEAD_STORE", "firestore");
      try {
        const store = await getLeadStore();
        expect(store).toBeDefined();
        if (!store) {
          return;
        }
        const lead = {
          kind: "newsletter" as const,
          email: probeEmail,
          receivedAt: new Date().toISOString(),
        };
        await expect(store.save(lead)).resolves.toBe("created");
        await expect(store.save(lead)).resolves.toBe("duplicate");
      } finally {
        await deleteProbeDocs();
      }
    },
    60_000,
  );
});
