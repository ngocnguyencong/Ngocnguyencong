import { slugify } from "./slug";

export const CONTENT_ENTRY_STATUSES = ["draft", "published", "archived"] as const;
export type ContentEntryStatus = (typeof CONTENT_ENTRY_STATUSES)[number];

/** Suggested entry types for forms; the column accepts any safe product-defined type. */
export const CONTENT_ENTRY_TYPES = ["post", "page", "doc", "report"] as const;

export function isContentEntryStatus(value: unknown): value is ContentEntryStatus {
  return typeof value === "string" && (CONTENT_ENTRY_STATUSES as readonly string[]).includes(value);
}

/** Content types are product-defined but must stay URL/slug-safe (e.g. "post", "kb_article"). */
export function normalizeContentType(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0 || normalized.length > 64) {
    return null;
  }
  return /^[a-z0-9][a-z0-9_-]*$/.test(normalized) ? normalized : null;
}

export type ContentEntryDraft = Readonly<{
  body: string;
  excerpt: string | null;
  locale: string | null;
  requiredEntitlement: string | null;
  slug: string;
  title: string;
  type: string;
}>;

/**
 * Entitlement keys name plan-tier grants ("pro", "ai.reference-task"). They
 * are equality-compared and rendered as text — never URL segments — so the
 * alphabet also allows dots, matching the flag-key alphabet in
 * `feature-flags.ts` and the dotted keys the billing pipeline grants.
 */
export function normalizeEntitlementKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0 || normalized.length > 100) {
    return null;
  }
  return /^[a-z0-9][a-z0-9._-]*$/.test(normalized) ? normalized : null;
}

export function normalizeContentEntryInput(
  raw: Readonly<{
    body?: string | undefined;
    excerpt?: string | undefined;
    locale?: string | undefined;
    requiredEntitlement?: string | undefined;
    slug?: string | undefined;
    title?: string | undefined;
    type?: string | undefined;
  }>,
): ContentEntryDraft | { error: string } {
  const type = normalizeContentType(raw.type ?? "");
  if (type === null) {
    return {
      error:
        "A content type of 1-64 lowercase letters, digits, dashes, or underscores is required.",
    };
  }
  const title = (raw.title ?? "").trim();
  if (title.length === 0 || title.length > 255) {
    return { error: "A title of 1-255 characters is required." };
  }
  const slugInput = (raw.slug ?? "").trim();
  const slug = slugInput.length > 0 ? slugify(slugInput, 200) : slugify(title, 200);
  if (slug.length === 0) {
    return { error: "A URL-safe slug is required (letters and digits)." };
  }
  const excerpt = (raw.excerpt ?? "").trim();
  const locale = (raw.locale ?? "").trim().toLowerCase();
  // Blank = ungated (free for every reader); a non-blank value must be a
  // safe entitlement key so typos can't silently publish an open entry.
  const requiredEntitlementRaw = (raw.requiredEntitlement ?? "").trim();
  const requiredEntitlement =
    requiredEntitlementRaw.length === 0 ? null : normalizeEntitlementKey(requiredEntitlementRaw);
  if (requiredEntitlementRaw.length > 0 && requiredEntitlement === null) {
    return {
      error:
        "An entitlement key of 1-100 lowercase letters, digits, dots, dashes, or underscores is required.",
    };
  }
  return {
    body: (raw.body ?? "").trim(),
    excerpt: excerpt.length > 0 ? excerpt : null,
    locale: locale.length > 0 ? locale.slice(0, 35) : null,
    requiredEntitlement,
    slug,
    title,
    type,
  };
}

export type ContentStatusDecision =
  | Readonly<{ ok: true; publishedAt: Date | null; status: ContentEntryStatus }>
  | Readonly<{ ok: false; reason: "invalid" | "unchanged" }>;

/**
 * Lifecycle is free (draft ↔ published ↔ archived); `publishedAt` stamps on
 * first publish and survives later unpublishes so readers keep the date.
 */
export function evaluateContentStatusChange(
  current: Readonly<{ publishedAt: Date | null; status: string }>,
  next: string,
  now: Date,
): ContentStatusDecision {
  if (!isContentEntryStatus(next)) {
    return { ok: false, reason: "invalid" };
  }
  if (next === current.status) {
    return { ok: false, reason: "unchanged" };
  }
  return {
    ok: true,
    publishedAt: next === "published" ? (current.publishedAt ?? now) : current.publishedAt,
    status: next,
  };
}
