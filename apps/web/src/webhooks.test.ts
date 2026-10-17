import { describe, expect, it } from "vitest";

import {
  WEBHOOK_EVENTS,
  buildWebhookPayload,
  isPubliclyRoutableHost,
  isValidWebhookEndpointUrl,
  nextWebhookRetryAt,
  signWebhookPayload,
} from "./webhooks";

describe("WEBHOOK_EVENTS", () => {
  it("exposes the product event catalog including ping", () => {
    expect(WEBHOOK_EVENTS).toContain("member.joined");
    expect(WEBHOOK_EVENTS).toContain("member.removed");
    expect(WEBHOOK_EVENTS).toContain("invite.accepted");
    expect(WEBHOOK_EVENTS).toContain("billing.processed");
    expect(WEBHOOK_EVENTS).toContain("ai.task_completed");
    expect(WEBHOOK_EVENTS).toContain("ping");
  });
});

describe("isValidWebhookEndpointUrl", () => {
  it("requires https in production and allows http locally", () => {
    expect(isValidWebhookEndpointUrl("https://hooks.example.com/in", true)).toBe(true);
    expect(isValidWebhookEndpointUrl("http://localhost:4000/hook", false)).toBe(true);
    expect(isValidWebhookEndpointUrl("http://hooks.example.com/in", true)).toBe(false);
    expect(isValidWebhookEndpointUrl("https://user:pw@hooks.example.com", true)).toBe(false);
    expect(isValidWebhookEndpointUrl("notaurl", false)).toBe(false);
    expect(isValidWebhookEndpointUrl("ftp://x.test", false)).toBe(false);
  });

  it.each([
    "https://169.254.169.254/",
    "https://10.1.2.3/",
    "https://172.16.5.4/",
    "https://192.168.1.1/",
    "https://127.0.0.1/",
    "https://0.0.0.0/",
    "https://[::1]/",
    "https://[::ffff:7f00:1]/",
    "https://[::ffff:127.0.0.1]/",
    "https://[fe80::1]/",
    "https://[fd00::1]/",
    "https://localhost/",
    "https://app.internal/",
    "https://x.local/",
    "https://metadata.google.internal/",
    "https://metadata/",
  ])("rejects non-public target %s in production", (value) => {
    expect(isValidWebhookEndpointUrl(value, true)).toBe(false);
  });

  it("still accepts public https endpoints in production", () => {
    expect(isValidWebhookEndpointUrl("https://hooks.example.com/in", true)).toBe(true);
    expect(isValidWebhookEndpointUrl("https://8.8.8.8/hook", true)).toBe(true);
  });

  it("keeps localhost and private http targets allowed outside production", () => {
    expect(isValidWebhookEndpointUrl("http://localhost:4000/hook", false)).toBe(true);
    expect(isValidWebhookEndpointUrl("http://192.168.1.5/h", false)).toBe(true);
  });
});

describe("isPubliclyRoutableHost", () => {
  it.each([
    ["loopback", "127.0.0.1"],
    ["unspecified", "0.0.0.0"],
    ["rfc1918 /8", "10.255.0.1"],
    ["cgnat", "100.64.0.1"],
    ["cgnat edge", "100.127.255.254"],
    ["link-local metadata", "169.254.169.254"],
    ["rfc1918 /12", "172.31.255.1"],
    ["rfc1918 /16", "192.168.0.1"],
    ["protocol assignments", "192.0.0.1"],
    ["doc net-1", "192.0.2.1"],
    ["benchmark", "198.18.0.1"],
    ["benchmark high", "198.19.255.1"],
    ["doc net-2", "198.51.100.1"],
    ["doc net-3", "203.0.113.1"],
    ["multicast", "224.0.0.1"],
    ["reserved", "240.0.0.1"],
    ["broadcast", "255.255.255.255"],
    ["v6 loopback", "::1"],
    ["v6 unspecified", "::"],
    ["v6 link-local", "fe80::1"],
    ["v6 ula", "fd12:3456::1"],
    ["v6 multicast", "ff02::1"],
    ["v6 doc", "2001:db8::1"],
    ["v4-mapped loopback", "::ffff:127.0.0.1"],
    ["v4-mapped hex form", "::ffff:7f00:1"],
    ["v4-compatible private", "::10.0.0.1"],
    ["v4-translated reserved", "::ffff:0:7f00:1"],
    ["v4-translated dotted", "::ffff:0:127.0.0.1"],
    ["nat64 well-known", "64:ff9b::8.8.8.8"],
    ["nat64 local-use", "64:ff9b:1::808:808"],
    ["nat64 local-use embedded private v4", "64:ff9b:1::a9fe:a9fe"],
    ["6to4 embedded private v4", "2002:a9fe:a9fe::1"],
    ["teredo", "2001::5efe:a9fe:a9fe"],
    ["malformed v6 triple colon", ":::"],
    ["malformed v6 double compression", "1::2::3"],
    ["localhost", "localhost"],
    ["subdomain of localhost", "app.localhost"],
    ["internal suffix", "app.internal"],
    ["local suffix", "printer.local"],
    ["lan suffix", "nas.lan"],
    ["corp suffix", "wiki.corp"],
    ["home suffix", "router.home"],
    ["home.arpa suffix", "router.home.arpa"],
    ["google metadata", "metadata.google.internal"],
    ["single label", "metadata"],
    ["fqdn trailing dot on blocked suffix", "x.local."],
    ["ipv4 shorthand loopback", "127.1"],
    ["ipv4 integer loopback", "2130706433"],
    ["bracketed v6 loopback", "[::1]"],
  ])("rejects %s (%s)", (_label, host) => {
    expect(isPubliclyRoutableHost(host)).toBe(false);
  });

  it.each([
    "8.8.8.8",
    "100.63.255.255",
    "172.15.255.1",
    "172.32.0.1",
    "hooks.example.com",
    "EXAMPLE.COM",
    "app.internal.example.com",
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
    "::8.8.8.8",
  ])("allows public host %s", (host) => {
    expect(isPubliclyRoutableHost(host)).toBe(true);
  });
});

describe("signWebhookPayload", () => {
  it("produces a Stripe-style t,v1 HMAC-SHA256 signature", () => {
    const signature = signWebhookPayload("whsec_test", 1700000000, '{"ok":true}');
    expect(signature).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
    expect(signWebhookPayload("whsec_test", 1700000000, '{"ok":true}')).toBe(signature);
    expect(signWebhookPayload("whsec_other", 1700000000, '{"ok":true}')).not.toBe(signature);
  });
});

describe("buildWebhookPayload", () => {
  it("wraps event data with id, type, workspace and timestamp", () => {
    const payload = buildWebhookPayload({
      data: { memberEmail: "a@b.test" },
      eventType: "member.joined",
      id: "evt_1",
      timestamp: new Date("2026-09-16T00:00:00.000Z"),
      workspaceId: "ws_1",
    });

    expect(payload).toEqual({
      createdAt: "2026-09-16T00:00:00.000Z",
      data: { memberEmail: "a@b.test" },
      id: "evt_1",
      type: "member.joined",
      workspaceId: "ws_1",
    });
  });

  it("includes the emit correlationId as top-level payload meta", () => {
    const payload = buildWebhookPayload({
      correlationId: "corr_emit-1",
      data: {},
      eventType: "billing.processed",
      id: "evt_2",
      timestamp: new Date("2026-09-16T00:00:00.000Z"),
      workspaceId: "ws_1",
    });

    expect(payload).toEqual({
      correlationId: "corr_emit-1",
      createdAt: "2026-09-16T00:00:00.000Z",
      data: {},
      id: "evt_2",
      type: "billing.processed",
      workspaceId: "ws_1",
    });
  });
});

describe("nextWebhookRetryAt", () => {
  const now = new Date("2026-09-16T00:00:00.000Z");

  it("backs off 1m, 5m, 30m and gives up after the fifth attempt", () => {
    expect(nextWebhookRetryAt(1, now)?.toISOString()).toBe("2026-09-16T00:01:00.000Z");
    expect(nextWebhookRetryAt(2, now)?.toISOString()).toBe("2026-09-16T00:05:00.000Z");
    expect(nextWebhookRetryAt(3, now)?.toISOString()).toBe("2026-09-16T00:30:00.000Z");
    expect(nextWebhookRetryAt(4, now)?.toISOString()).toBe("2026-09-16T00:30:00.000Z");
    expect(nextWebhookRetryAt(5, now)).toBeNull();
  });
});
