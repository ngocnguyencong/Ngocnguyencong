import { describe, expect, it } from "vitest";

import {
  extractNotificationHref,
  resolveNotificationRoute,
  routeForNotificationResponse,
} from "./deep-links";

/** Minimal `expo-notifications` `NotificationResponse` shape. */
function makeResponse(data: unknown) {
  return {
    actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
    notification: {
      date: 1_700_000_000_000,
      request: {
        content: { body: "body", data, title: "title" },
        identifier: "request-1",
        trigger: null,
      },
    },
  };
}

describe("extractNotificationHref", () => {
  it("reads data.href off the response content", () => {
    expect(extractNotificationHref(makeResponse({ href: "/settings/members" }))).toBe(
      "/settings/members",
    );
  });

  it("returns null when data is missing or not an object", () => {
    expect(extractNotificationHref(makeResponse(undefined))).toBeNull();
    expect(extractNotificationHref(makeResponse(null))).toBeNull();
    expect(extractNotificationHref(makeResponse("/billing"))).toBeNull();
    expect(extractNotificationHref(makeResponse(["/billing"]))).toBeNull();
  });

  it("returns null when href is missing or not a string", () => {
    expect(extractNotificationHref(makeResponse({}))).toBeNull();
    expect(extractNotificationHref(makeResponse({ href: 42 }))).toBeNull();
    expect(extractNotificationHref(makeResponse({ href: null }))).toBeNull();
    expect(extractNotificationHref(makeResponse({ href: { path: "/billing" } }))).toBeNull();
  });

  it("returns null when the response shape is malformed at any level", () => {
    expect(extractNotificationHref(null)).toBeNull();
    expect(extractNotificationHref("response")).toBeNull();
    expect(extractNotificationHref({})).toBeNull();
    expect(extractNotificationHref({ notification: null })).toBeNull();
    expect(extractNotificationHref({ notification: { request: null } })).toBeNull();
    expect(extractNotificationHref({ notification: { request: { content: "x" } } })).toBeNull();
  });
});

describe("resolveNotificationRoute", () => {
  it("passes valid internal paths through unchanged", () => {
    expect(resolveNotificationRoute("/notifications")).toBe("/notifications");
    expect(resolveNotificationRoute("/settings/members")).toBe("/settings/members");
    expect(resolveNotificationRoute("/chat/thread-1")).toBe("/chat/thread-1");
    expect(resolveNotificationRoute("/")).toBe("/");
  });

  it("rewrites web hrefs whose mobile screens live elsewhere", () => {
    // The sender emits web paths: /billing → settings screen, /dashboard → home tab.
    expect(resolveNotificationRoute("/billing")).toBe("/settings/billing");
    expect(resolveNotificationRoute("/dashboard")).toBe("/home");
  });

  it("sends the /ai budget alert to billing settings (no mobile console)", () => {
    expect(resolveNotificationRoute("/ai")).toBe("/settings/billing");
    expect(resolveNotificationRoute("/ai?taskId=t1")).toBe("/settings/billing?taskId=t1");
  });

  it("preserves query strings and hash fragments across the rewrite", () => {
    expect(resolveNotificationRoute("/billing?tab=plans")).toBe("/settings/billing?tab=plans");
    expect(resolveNotificationRoute("/settings/members#pending")).toBe("/settings/members#pending");
    expect(resolveNotificationRoute("/notifications?filter=unread#top")).toBe(
      "/notifications?filter=unread#top",
    );
  });

  it("normalizes trailing slashes before mapping", () => {
    expect(resolveNotificationRoute("/billing/")).toBe("/settings/billing");
    expect(resolveNotificationRoute("/settings/members/")).toBe("/settings/members");
  });

  it("trims surrounding whitespace", () => {
    expect(resolveNotificationRoute("  /notifications  ")).toBe("/notifications");
  });

  it("rejects non-strings and empty input", () => {
    for (const value of [null, undefined, 42, true, {}, [], "", "   ", "\n\t"]) {
      expect(resolveNotificationRoute(value)).toBeNull();
    }
  });

  it("rejects external URLs, schemes, and protocol-relative paths", () => {
    for (const value of [
      "https://evil.example",
      "http://evil.example/x",
      "javascript:alert(1)",
      "data:text/html,<b>x</b>",
      "mailto:a@b.c",
      "//evil.example",
      "//evil.example/path",
      "//",
    ]) {
      expect(resolveNotificationRoute(value)).toBeNull();
    }
  });

  it("rejects backslashes, interior //, whitespace, and control characters", () => {
    for (const value of [
      "\\evil",
      "/\\evil",
      "/a//b",
      "/has space",
      "/tab\there",
      "/line\nbreak",
      "/nul\u0008yte",
      "/del\x7fete",
      "/carriage\rreturn",
    ]) {
      expect(resolveNotificationRoute(value)).toBeNull();
    }
  });

  it("rejects dot-dot traversal segments", () => {
    expect(resolveNotificationRoute("/../secret")).toBeNull();
    expect(resolveNotificationRoute("/a/../b")).toBeNull();
    expect(resolveNotificationRoute("/..")).toBeNull();
  });

  it("rejects overlong payloads", () => {
    expect(resolveNotificationRoute(`/${"a".repeat(512)}`)).toBeNull();
    expect(resolveNotificationRoute(`/${"a".repeat(511)}`)).toBe(`/${"a".repeat(511)}`);
  });
});

describe("routeForNotificationResponse", () => {
  it("resolves a routable payload end to end", () => {
    expect(routeForNotificationResponse(makeResponse({ href: "/billing" }))).toBe(
      "/settings/billing",
    );
    expect(routeForNotificationResponse(makeResponse({ href: "/settings/connections" }))).toBe(
      "/settings/connections",
    );
  });

  it("returns null for notifications without an href", () => {
    expect(routeForNotificationResponse(makeResponse({}))).toBeNull();
  });

  it("returns null for unsafe or malformed payloads", () => {
    expect(routeForNotificationResponse(makeResponse({ href: "https://evil.example" }))).toBeNull();
    expect(routeForNotificationResponse(makeResponse({ href: "" }))).toBeNull();
    expect(routeForNotificationResponse(null)).toBeNull();
    expect(routeForNotificationResponse({ notification: "garbage" })).toBeNull();
  });
});
