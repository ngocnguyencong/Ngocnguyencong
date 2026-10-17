import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  evaluateContentStatusChange,
  isContentEntryStatus,
  normalizeContentEntryInput,
  normalizeContentType,
  normalizeEntitlementKey,
} from "./content";
import { slugify } from "./slug";

describe("slugify", () => {
  it("produces lowercase dashed slugs and strips diacritics", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("Café au lait")).toBe("cafe-au-lait");
    expect(slugify("  --Spaced___Out--  ")).toBe("spaced-out");
    expect(slugify("产品 发布")).toBe("");
  });

  it("caps at maxLength without leaving a trailing dash", () => {
    expect(slugify("a".repeat(200), 120).length).toBe(120);
    expect(slugify("hello-world-again", 11)).toBe("hello-world");
    expect(slugify("hello-world-again", 12)).toBe("hello-world");
  });
});

describe("normalizeContentType", () => {
  it("accepts slug-safe type names", () => {
    expect(normalizeContentType("post")).toBe("post");
    expect(normalizeContentType("Landing-Page")).toBe("landing-page");
    expect(normalizeContentType("kb_article")).toBe("kb_article");
  });

  it("rejects empty or unsafe type names", () => {
    expect(normalizeContentType("")).toBeNull();
    expect(normalizeContentType("  ")).toBeNull();
    expect(normalizeContentType("a/b")).toBeNull();
    expect(normalizeContentType("a".repeat(65))).toBeNull();
  });
});

describe("normalizeEntitlementKey", () => {
  it("accepts the keys the billing pipeline actually grants", () => {
    // Plan entitlements (product-plans.ts / billing-runtime.ts) ship keys
    // like "ai.reference-task" — dots must be allowed or the real grant can
    // never be entered as a CMS required_entitlement.
    expect(normalizeEntitlementKey("ai.reference-task")).toBe("ai.reference-task");
    expect(normalizeEntitlementKey(" Pro ")).toBe("pro");
    expect(normalizeEntitlementKey("team_tier-2")).toBe("team_tier-2");
  });

  it("rejects empty, oversized, or unsafe keys", () => {
    expect(normalizeEntitlementKey("")).toBeNull();
    expect(normalizeEntitlementKey("a".repeat(101))).toBeNull();
    expect(normalizeEntitlementKey("pro tier!")).toBeNull();
    expect(normalizeEntitlementKey("a/b")).toBeNull();
    expect(normalizeEntitlementKey(".leading-dot")).toBeNull();
    expect(normalizeEntitlementKey(42)).toBeNull();
  });
});

describe("isContentEntryStatus", () => {
  it("accepts the three lifecycle states", () => {
    expect(isContentEntryStatus("draft")).toBe(true);
    expect(isContentEntryStatus("published")).toBe(true);
    expect(isContentEntryStatus("archived")).toBe(true);
    expect(isContentEntryStatus("live")).toBe(false);
  });
});

describe("normalizeContentEntryInput", () => {
  it("trims fields and slugifies the slug", () => {
    const result = normalizeContentEntryInput({
      body: "  Body text ",
      excerpt: " Short ",
      locale: "EN-us ",
      slug: "My First Post!",
      title: "  Hello ",
      type: "POST",
    });
    expect(result).toEqual({
      body: "Body text",
      excerpt: "Short",
      locale: "en-us",
      requiredEntitlement: null,
      slug: "my-first-post",
      title: "Hello",
      type: "post",
    });
  });

  it("derives a slug from the title when the slug field is empty", () => {
    const result = normalizeContentEntryInput({ slug: "", title: "Launch Notes", type: "post" });
    expect("slug" in result && result.slug).toBe("launch-notes");
  });

  it("normalizes requiredEntitlement: trims, lowercases, nulls blanks, rejects unsafe keys", () => {
    expect(
      normalizeContentEntryInput({ title: "T", type: "post", requiredEntitlement: "  Pro " }),
    ).toMatchObject({ requiredEntitlement: "pro" });
    expect(
      normalizeContentEntryInput({ title: "T", type: "post", requiredEntitlement: "" }),
    ).toMatchObject({ requiredEntitlement: null });
    expect(normalizeContentEntryInput({ title: "T", type: "post" })).toMatchObject({
      requiredEntitlement: null,
    });
    expect(
      normalizeContentEntryInput({
        title: "T",
        type: "post",
        requiredEntitlement: "ai.reference-task",
      }),
    ).toMatchObject({ requiredEntitlement: "ai.reference-task" });
    expect(
      normalizeContentEntryInput({ title: "T", type: "post", requiredEntitlement: "pro tier!" }),
    ).toEqual({ error: expect.stringContaining("dots") });
  });

  it("rejects missing title, slug, or type", () => {
    expect(normalizeContentEntryInput({ slug: "x", title: "", type: "post" })).toEqual({
      error: expect.any(String),
    });
    expect(normalizeContentEntryInput({ slug: "!!!", title: "t", type: "post" })).toEqual({
      error: expect.any(String),
    });
    expect(normalizeContentEntryInput({ slug: "x", title: "t", type: "a/b" })).toEqual({
      error: expect.any(String),
    });
  });
});

describe("evaluateContentStatusChange", () => {
  const now = new Date("2026-09-22T12:00:00Z");

  it("stamps publishedAt on first publish and keeps it afterwards", () => {
    const first = evaluateContentStatusChange(
      { publishedAt: null, status: "draft" },
      "published",
      now,
    );
    expect(first).toEqual({ ok: true, publishedAt: now, status: "published" });

    const earlier = new Date("2026-01-01T00:00:00Z");
    const republish = evaluateContentStatusChange(
      { publishedAt: earlier, status: "archived" },
      "published",
      now,
    );
    expect(republish).toEqual({ ok: true, publishedAt: earlier, status: "published" });
  });

  it("keeps publishedAt when unpublishing or archiving", () => {
    const earlier = new Date("2026-01-01T00:00:00Z");
    expect(
      evaluateContentStatusChange({ publishedAt: earlier, status: "published" }, "draft", now),
    ).toEqual({ ok: true, publishedAt: earlier, status: "draft" });
    expect(
      evaluateContentStatusChange({ publishedAt: earlier, status: "published" }, "archived", now),
    ).toEqual({ ok: true, publishedAt: earlier, status: "archived" });
  });

  it("rejects unknown statuses and no-op transitions", () => {
    expect(
      evaluateContentStatusChange({ publishedAt: null, status: "draft" }, "live", now),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      evaluateContentStatusChange({ publishedAt: null, status: "draft" }, "draft", now),
    ).toEqual({ ok: false, reason: "unchanged" });
  });
});

describe("content server actions contract", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const actions = readFileSync(join(here, "content-actions.ts"), "utf8");

  it("scopes every query and mutation by workspaceId", () => {
    expect(actions).toContain("eq(contentEntry.workspaceId, context.workspaceId)");
    expect(actions.match(/eq\(contentEntry\.workspaceId/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("gates all management operations behind the workspace writer role", () => {
    expect(actions.match(/requireWorkspaceWriter\(\)/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("records audit events and emits content.published on publish", () => {
    expect(actions).toContain("AUDIT_ACTIONS.contentEntryCreated");
    expect(actions).toContain("AUDIT_ACTIONS.contentEntryStatusChanged");
    expect(actions).toContain("AUDIT_ACTIONS.contentEntryDeleted");
    expect(actions).toContain('"content.published"');
  });
});

describe("content access boundary contract", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const actions = readFileSync(join(here, "content-actions.ts"), "utf8");
  const queries = readFileSync(join(here, "content-queries.ts"), "utf8");
  const gate = readFileSync(join(here, "entitlement-gate.tsx"), "utf8");

  it("keeps the public published-read off the server-action module", () => {
    // "use server" exports are public RPC endpoints — a caller-supplied
    // `viewerEntitlements` param there would let clients forge grants.
    expect(actions).not.toContain("listPublishedContentEntries");
    expect(queries).toMatch(/^import "server-only";/);
    expect(queries).toContain("export async function listPublishedContentEntries");
  });

  it("routes the paywall gate through the shared entitlement loader", () => {
    expect(gate).not.toContain("@supastack/db");
    expect(gate).not.toContain("database");
    expect(gate).toContain('from "./entitlements"');
    expect(gate).toContain("listViewerEntitlements");
  });
});
