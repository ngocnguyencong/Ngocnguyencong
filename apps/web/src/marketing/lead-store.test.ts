import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createMock = vi.fn();
const addMock = vi.fn();
const docMock = vi.fn(() => ({ create: createMock }));
const collectionMock = vi.fn(() => ({ doc: docMock, add: addMock }));
const getFirestoreMock = vi.fn(() => ({ collection: collectionMock }));
const getAppsMock = vi.fn(() => [] as unknown[]);
const initializeAppMock = vi.fn(() => ({ name: "mock-app" }));
const certMock = vi.fn(() => ({}));

vi.mock("firebase-admin/app", () => ({
  getApps: getAppsMock,
  initializeApp: initializeAppMock,
  cert: certMock,
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: getFirestoreMock,
}));

import { getLeadStore } from "./lead-store";
import type { LeadRecord } from "./marketing-leads";

let dir: string | undefined;

const newsletterLead: LeadRecord = {
  kind: "newsletter",
  email: "a@b.co",
  receivedAt: "2026-09-21T00:00:00Z",
};

const contactLead: LeadRecord = {
  kind: "contact",
  email: "ada@example.com",
  name: "Ada",
  message: "Hello",
  receivedAt: "2026-09-21T00:00:00Z",
};

afterEach(async () => {
  vi.unstubAllEnvs();
  createMock.mockReset();
  addMock.mockReset();
  docMock.mockClear();
  collectionMock.mockClear();
  getFirestoreMock.mockClear();
  getAppsMock.mockReset();
  getAppsMock.mockReturnValue([]);
  initializeAppMock.mockClear();
  certMock.mockClear();
  if (dir) {
    await rm(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

describe("getLeadStore", () => {
  it("returns undefined when MARKETING_LEAD_STORE is unset", async () => {
    vi.stubEnv("MARKETING_LEAD_STORE", "");
    await expect(getLeadStore()).resolves.toBeUndefined();
  });

  it("throws on an unknown MARKETING_LEAD_STORE value", async () => {
    vi.stubEnv("MARKETING_LEAD_STORE", "postgres");
    await expect(getLeadStore()).rejects.toThrow(/MARKETING_LEAD_STORE/);
  });
});

describe("local lead store", () => {
  it("persists leads to JSON, dedupes newsletter by email, keeps repeat contacts", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "supastack-leads-"));
    const file = path.join(dir, "leads.json");
    vi.stubEnv("MARKETING_LEAD_STORE", "local");
    vi.stubEnv("MARKETING_LEAD_STORE_PATH", file);

    const store = await getLeadStore();
    expect(store).toBeDefined();
    if (!store) {
      return;
    }

    expect(await store.save(newsletterLead)).toBe("created");
    expect(await store.save(newsletterLead)).toBe("duplicate");
    expect(await store.save(contactLead)).toBe("created");
    expect(await store.save(contactLead)).toBe("created");

    const written = JSON.parse(await readFile(file, "utf8")) as LeadRecord[];
    expect(written).toHaveLength(3);
    expect(written.filter((lead) => lead.kind === "newsletter")).toHaveLength(1);
    expect(written.filter((lead) => lead.kind === "contact")).toHaveLength(2);
  });
});

describe("firestore lead store", () => {
  function stubFirebaseEnv() {
    vi.stubEnv("MARKETING_LEAD_STORE", "firestore");
    vi.stubEnv("FIREBASE_PROJECT_ID", "demo-project");
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "sa@demo-project.iam.gserviceaccount.com");
    vi.stubEnv(
      "FIREBASE_PRIVATE_KEY",
      "-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\n",
    );
    vi.stubEnv("FIRESTORE_DATABASE", "leads-db");
  }

  it("creates a namespaced newsletter doc and maps ALREADY_EXISTS to duplicate", async () => {
    stubFirebaseEnv();
    createMock.mockResolvedValueOnce(undefined);

    const store = await getLeadStore();
    expect(store).toBeDefined();
    if (!store) {
      return;
    }

    expect(await store.save(newsletterLead)).toBe("created");
    expect(collectionMock).toHaveBeenCalledWith("marketing_leads");
    expect(docMock).toHaveBeenCalledWith("newsletter:a@b.co");
    expect(getFirestoreMock).toHaveBeenCalledWith({ name: "mock-app" }, "leads-db");

    createMock.mockRejectedValueOnce(Object.assign(new Error("exists"), { code: 6 }));
    expect(await store.save(newsletterLead)).toBe("duplicate");
  });

  it("stores each contact message as a new auto-id doc", async () => {
    stubFirebaseEnv();
    addMock.mockResolvedValue({ id: "auto-1" });

    const store = await getLeadStore();
    expect(store).toBeDefined();
    if (!store) {
      return;
    }

    expect(await store.save(contactLead)).toBe("created");
    expect(await store.save(contactLead)).toBe("created");
    expect(addMock).toHaveBeenCalledTimes(2);
    expect(addMock.mock.calls[0]?.[0]).toMatchObject({
      kind: "contact",
      email: "ada@example.com",
      name: "Ada",
      message: "Hello",
    });
    expect(docMock).not.toHaveBeenCalled();
  });

  it("throws when required Firebase env vars are missing", async () => {
    vi.stubEnv("MARKETING_LEAD_STORE", "firestore");
    await expect(getLeadStore()).rejects.toThrow(/FIREBASE_PROJECT_ID/);
  });
});
