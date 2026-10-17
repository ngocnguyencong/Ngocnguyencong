import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createEntry: vi.fn(),
  deleteEntry: vi.fn(),
  getEntry: vi.fn(),
  listEntries: vi.fn(),
  requireWriter: vi.fn(),
  setStatus: vi.fn(),
  updateEntry: vi.fn(),
}));
vi.mock("./content-actions", () => ({
  createContentEntryAction: mocks.createEntry,
  deleteContentEntryAction: mocks.deleteEntry,
  getContentEntry: mocks.getEntry,
  listContentEntries: mocks.listEntries,
  setContentEntryStatusAction: mocks.setStatus,
  updateContentEntryAction: mocks.updateEntry,
}));
vi.mock("./workspace-access", () => ({ requireWorkspaceWriter: mocks.requireWriter }));

import { GET, POST } from "../app/api/mobile/content/route";
import { DELETE, GET as ITEM_GET, PATCH } from "../app/api/mobile/content/[entryId]/route";

const entry = {
  body: "Markdown body",
  createdAt: new Date("2026-10-01T12:00:00.000Z"),
  excerpt: null,
  id: "con_1",
  locale: null,
  publishedAt: new Date("2026-10-02T00:00:00.000Z"),
  requiredEntitlement: "pro",
  slug: "hello-world",
  status: "published",
  title: "Hello world",
  type: "post",
  updatedAt: new Date("2026-10-03T00:00:00.000Z"),
};

const collectionUrl = "https://app.test/api/mobile/content";
const itemUrl = "https://app.test/api/mobile/content/con_1";
const itemContext = { params: Promise.resolve({ entryId: "con_1" }) };

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, { body: JSON.stringify(body), method });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireWriter.mockResolvedValue({
    role: "member",
    userId: "user_1",
    workspaceId: "ws_1",
  });
  mocks.listEntries.mockResolvedValue({ entries: [entry], writable: true });
  mocks.getEntry.mockResolvedValue({ entry });
  mocks.createEntry.mockResolvedValue({ entryId: "con_1", ok: true });
  mocks.updateEntry.mockResolvedValue({ entryId: "con_1", ok: true });
  mocks.setStatus.mockResolvedValue(undefined);
  mocks.deleteEntry.mockResolvedValue(undefined);
});

describe("/api/mobile/content route", () => {
  it("GET serializes entries with ISO dates and keeps body server-side", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const listEntry: Partial<typeof entry> = { ...entry };
    delete listEntry.body;
    expect(await response.json()).toEqual({
      entries: [
        {
          ...listEntry,
          createdAt: "2026-10-01T12:00:00.000Z",
          publishedAt: "2026-10-02T00:00:00.000Z",
          updatedAt: "2026-10-03T00:00:00.000Z",
        },
      ],
      writable: true,
    });
  });

  it("GET maps a null publishedAt and list errors to 401/403", async () => {
    mocks.listEntries.mockResolvedValue({
      entries: [{ ...entry, publishedAt: null }],
      writable: true,
    });
    const listed = await GET();
    expect((await listed.json()).entries[0].publishedAt).toBeNull();

    mocks.listEntries.mockResolvedValue({
      entries: [],
      error: "Member role or above required.",
      writable: false,
    });
    expect((await GET()).status).toBe(403);

    mocks.listEntries.mockResolvedValue({
      entries: [],
      error: "Sign in required.",
      writable: false,
    });
    expect((await GET()).status).toBe(401);
  });

  it("POST authenticates before consuming the body", async () => {
    mocks.requireWriter.mockResolvedValue({ error: "Member role or above required." });
    const request = jsonRequest(collectionUrl, "POST", { title: "Hi", type: "post" });
    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(request.bodyUsed).toBe(false);
    expect(mocks.createEntry).not.toHaveBeenCalled();
  });

  it("POST forwards the parsed fields and returns 201 {entryId}", async () => {
    const response = await POST(
      jsonRequest(collectionUrl, "POST", {
        excerpt: "Short",
        slug: "hello-world",
        title: "Hello world",
        type: "post",
      }),
    );
    expect(mocks.createEntry).toHaveBeenCalledWith({
      body: "",
      excerpt: "Short",
      locale: "",
      requiredEntitlement: "",
      slug: "hello-world",
      title: "Hello world",
      type: "post",
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ entryId: "con_1" });
  });

  it("POST maps action failures to 422 and malformed JSON to 400", async () => {
    mocks.createEntry.mockResolvedValue({
      error: 'A post entry with slug "hello-world" already exists.',
      ok: false,
    });
    const conflict = await POST(jsonRequest(collectionUrl, "POST", { title: "Hi" }));
    expect(conflict.status).toBe(422);
    expect(await conflict.json()).toEqual({
      error: 'A post entry with slug "hello-world" already exists.',
    });

    const malformed = await POST(new Request(collectionUrl, { body: "not json", method: "POST" }));
    expect(malformed.status).toBe(400);
  });
});

describe("/api/mobile/content/[entryId] route", () => {
  it("GET returns a single entry with its body and ISO dates", async () => {
    const response = await ITEM_GET(new Request(itemUrl, { method: "GET" }), itemContext);
    expect(response.status).toBe(200);
    expect(mocks.getEntry).toHaveBeenCalledWith("con_1");
    expect(await response.json()).toEqual({
      entry: {
        ...entry,
        createdAt: "2026-10-01T12:00:00.000Z",
        publishedAt: "2026-10-02T00:00:00.000Z",
        updatedAt: "2026-10-03T00:00:00.000Z",
      },
    });
  });

  it("GET 404s for an unknown entry and maps access errors to 401/403", async () => {
    mocks.getEntry.mockResolvedValue({ entry: null });
    const missing = await ITEM_GET(new Request(itemUrl, { method: "GET" }), {
      params: Promise.resolve({ entryId: "con_missing" }),
    });
    expect(missing.status).toBe(404);

    mocks.getEntry.mockResolvedValue({
      entry: null,
      error: "Member role or above required.",
    });
    const denied = await ITEM_GET(new Request(itemUrl, { method: "GET" }), itemContext);
    expect(denied.status).toBe(403);

    mocks.getEntry.mockResolvedValue({
      entry: null,
      error: "Sign in required.",
    });
    const anonymous = await ITEM_GET(new Request(itemUrl, { method: "GET" }), itemContext);
    expect(anonymous.status).toBe(401);
  });

  it("PATCH forwards string fields to the update action", async () => {
    const response = await PATCH(
      jsonRequest(itemUrl, "PATCH", { title: "Renamed", type: "post" }),
      itemContext,
    );
    expect(mocks.updateEntry).toHaveBeenCalledWith({
      entryId: "con_1",
      title: "Renamed",
      type: "post",
    });
    expect(mocks.setStatus).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("PATCH maps update failures to 422 and skips a paired status", async () => {
    mocks.updateEntry.mockResolvedValue({ error: "Content entry not found.", ok: false });
    const response = await PATCH(
      jsonRequest(itemUrl, "PATCH", { status: "archived", title: "Renamed" }),
      itemContext,
    );
    expect(response.status).toBe(422);
    expect(mocks.setStatus).not.toHaveBeenCalled();
  });

  it("PATCH status-only bridges to the FormData status action", async () => {
    const response = await PATCH(
      jsonRequest(itemUrl, "PATCH", { status: "published" }),
      itemContext,
    );
    expect(mocks.updateEntry).not.toHaveBeenCalled();
    const form = mocks.setStatus.mock.calls[0]![0] as FormData;
    expect(form.get("entryId")).toBe("con_1");
    expect(form.get("status")).toBe("published");
    expect(response.status).toBe(200);
  });

  it("PATCH rejects an unknown status and an empty body with 400", async () => {
    const unknown = await PATCH(jsonRequest(itemUrl, "PATCH", { status: "drafted" }), itemContext);
    expect(unknown.status).toBe(400);

    const empty = await PATCH(jsonRequest(itemUrl, "PATCH", {}), itemContext);
    expect(empty.status).toBe(400);
    expect(mocks.updateEntry).not.toHaveBeenCalled();
    expect(mocks.setStatus).not.toHaveBeenCalled();
  });

  it("DELETE requires the writer role and bridges to FormData", async () => {
    mocks.requireWriter.mockResolvedValue({ error: "Member role or above required." });
    const denied = await DELETE(new Request(itemUrl, { method: "DELETE" }), itemContext);
    expect(denied.status).toBe(403);
    expect(mocks.deleteEntry).not.toHaveBeenCalled();

    mocks.requireWriter.mockResolvedValue({
      role: "member",
      userId: "user_1",
      workspaceId: "ws_1",
    });
    const response = await DELETE(new Request(itemUrl, { method: "DELETE" }), itemContext);
    const form = mocks.deleteEntry.mock.calls[0]![0] as FormData;
    expect(form.get("entryId")).toBe("con_1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
