import { describe, expect, it } from "vitest";

import { normalizeCustomHostname } from "./hostname";

const options = {
  appHost: "app.supastack.dev",
  cnameTarget: "customers.supastack.dev",
};

describe("normalizeCustomHostname", () => {
  it("trims, lowercases, and strips a trailing dot", () => {
    expect(normalizeCustomHostname("  App.Customer-Example.COM. ", options)).toEqual({
      hostname: "app.customer-example.com",
      ok: true,
    });
  });

  it("converts IDN input to punycode", () => {
    const result = normalizeCustomHostname("bücher.example.de", options);
    expect(result).toEqual({ hostname: "xn--bcher-kva.example.de", ok: true });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["https://app.example.com", "invalid-format"],
    ["app.example.com/path", "invalid-format"],
    ["app.example.com:8443", "invalid-format"],
    ["user@app.example.com", "invalid-format"],
    ["*.example.com", "wildcard"],
    ["app.*.example.com", "wildcard"],
    ["192.168.1.10", "ip-address"],
    ["[::1]", "invalid-format"],
    ["::1", "invalid-format"],
    ["localhost", "localhost"],
    ["app.localhost", "localhost"],
    ["-bad.example.com", "invalid-label"],
    ["bad-.example.com", "invalid-label"],
    ["bad_label.example.com", "invalid-label"],
    ["app.supastack.dev", "reserved-app-host"],
    ["tenant.app.supastack.dev", "reserved-app-host"],
    ["customers.supastack.dev", "reserved-target"],
    [`${"a".repeat(64)}.example.com`, "invalid-label"],
  ])("rejects %s with %s", (input, error) => {
    expect(normalizeCustomHostname(input, options)).toEqual({ error, ok: false });
  });

  it("rejects names over 253 characters", () => {
    const long = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.com`;
    expect(long.length).toBeGreaterThan(253);
    expect(normalizeCustomHostname(long, options)).toEqual({ error: "too-long", ok: false });
  });

  it("accepts a normal multi-label hostname", () => {
    expect(normalizeCustomHostname("portal.acme-corp.io", options)).toEqual({
      hostname: "portal.acme-corp.io",
      ok: true,
    });
    // Two syntactically valid labels pass even on non-public suffixes — DNS
    // resolution is what ultimately decides reachability.
    expect(normalizeCustomHostname("app.internal", options)).toEqual({
      hostname: "app.internal",
      ok: true,
    });
  });
});
