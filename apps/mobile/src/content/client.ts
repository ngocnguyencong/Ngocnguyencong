import type { MobileApiClient } from "../api/client";

/** Mirrors `CONTENT_ENTRY_STATUSES` in `apps/web/src/content.ts` — keep in sync. */
export const CONTENT_ENTRY_STATUSES = ["draft", "published", "archived"] as const;
export type ContentEntryStatus = (typeof CONTENT_ENTRY_STATUSES)[number];

export interface ContentEntry {
  createdAt: string;
  excerpt: string | null;
  id: string;
  locale: string | null;
  publishedAt: string | null;
  requiredEntitlement: string | null;
  slug: string;
  status: ContentEntryStatus;
  title: string;
  type: string;
  updatedAt: string;
}

/**
 * Single-entry read (`GET /api/mobile/content/:entryId`) — the list row
 * plus the `body` the edit form prefills. PATCH is a full-form replace,
 * so editing without this read would silently wipe the stored body.
 */
export interface ContentEntryDetail extends ContentEntry {
  body: string;
}

/** Editable fields accepted by `POST`/`PATCH /api/mobile/content`. */
export interface ContentEntryFields {
  body?: string;
  excerpt?: string;
  locale?: string;
  requiredEntitlement?: string;
  slug?: string;
  title?: string;
  type?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isContentEntryStatus(value: unknown): value is ContentEntryStatus {
  return typeof value === "string" && (CONTENT_ENTRY_STATUSES as readonly string[]).includes(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

// Rows missing a usable id/title/type/status/date are dropped rather than
// guessed — defaults would mislabel entries and collide on React keys.
function isContentEntry(value: unknown): value is ContentEntry {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.title === "string" &&
    typeof value.type === "string" &&
    typeof value.slug === "string" &&
    isContentEntryStatus(value.status) &&
    isIsoDate(value.createdAt) &&
    isIsoDate(value.updatedAt) &&
    (value.publishedAt === null || isIsoDate(value.publishedAt)) &&
    (value.excerpt === null || typeof value.excerpt === "string") &&
    (value.locale === null || typeof value.locale === "string") &&
    (value.requiredEntitlement === null || typeof value.requiredEntitlement === "string")
  );
}

function isContentEntryDetail(value: unknown): value is ContentEntryDetail {
  // `body` must be checked while `value` is still a generic record —
  // `isContentEntry` narrows to a type without that key.
  return isRecord(value) && typeof value.body === "string" && isContentEntry(value);
}

function entryPath(entryId: string): string {
  return `/api/mobile/content/${encodeURIComponent(entryId)}`;
}

/**
 * `/api/mobile/content` — workspace CMS entries. Member role or above
 * required server-side; guests get an error from `list`.
 */
export function createMobileContentActions(api: MobileApiClient) {
  return {
    async create(fields: ContentEntryFields): Promise<{ entryId: string }> {
      const payload = await api.request<unknown>("/api/mobile/content", {
        body: fields,
        method: "POST",
      });
      if (!isRecord(payload) || typeof payload.entryId !== "string") {
        throw new Error("The entry could not be created.");
      }
      return { entryId: payload.entryId };
    },

    /** One entry including `body` — the prefill source for `update`. */
    async get(entryId: string): Promise<ContentEntryDetail> {
      const payload = await api.request<unknown>(entryPath(entryId));
      if (!isRecord(payload) || !isContentEntryDetail(payload.entry)) {
        throw new Error("The content entry was invalid.");
      }
      return payload.entry;
    },

    async list(): Promise<{ entries: ContentEntry[]; writable: boolean }> {
      const payload = await api.request<unknown>("/api/mobile/content");
      if (!isRecord(payload) || !Array.isArray(payload.entries)) {
        throw new Error("The content list was invalid.");
      }
      return {
        entries: (payload.entries as unknown[]).filter(isContentEntry),
        writable: payload.writable === true,
      };
    },

    async remove(entryId: string): Promise<void> {
      await api.request(entryPath(entryId), { method: "DELETE" });
    },

    async setStatus(entryId: string, status: ContentEntryStatus): Promise<void> {
      await api.request(entryPath(entryId), { body: { status }, method: "PATCH" });
    },

    /** Full-form replace — `type` + `title` are required server-side. */
    async update(entryId: string, fields: ContentEntryFields): Promise<void> {
      await api.request(entryPath(entryId), { body: fields, method: "PATCH" });
    },
  };
}
