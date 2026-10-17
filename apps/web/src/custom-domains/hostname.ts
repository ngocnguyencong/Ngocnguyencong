import { isIP } from "node:net";
import { domainToASCII } from "node:url";

/**
 * Pure hostname validation for customer-supplied custom domains. The checks
 * run before any provider call so bad input never reaches Cloudflare.
 */

export type CustomHostnameRejection =
  | "empty"
  | "invalid-format"
  | "invalid-label"
  | "ip-address"
  | "localhost"
  | "reserved-app-host"
  | "reserved-target"
  | "single-label"
  | "too-long"
  | "wildcard";

export type CustomHostnameResult =
  { error: CustomHostnameRejection; ok: false } | { hostname: string; ok: true };

const LABEL_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeCustomHostname(
  input: string,
  options: Readonly<{ appHost: string; cnameTarget: string }>,
): CustomHostnameResult {
  const raw = input.trim().toLowerCase().replace(/\.$/, "");
  if (raw.length === 0) {
    return { error: "empty", ok: false };
  }
  if (/[\s:/?#@\\[\]]/.test(raw) || raw.includes("://")) {
    return { error: "invalid-format", ok: false };
  }
  if (raw.includes("*")) {
    return { error: "wildcard", ok: false };
  }
  if (isIP(raw) !== 0) {
    return { error: "ip-address", ok: false };
  }
  if (raw === "localhost" || raw.endsWith(".localhost")) {
    return { error: "localhost", ok: false };
  }
  if (raw.length > 253) {
    return { error: "too-long", ok: false };
  }

  const ascii = domainToASCII(raw);
  if (ascii.length === 0 || ascii.length > 253) {
    return { error: "invalid-format", ok: false };
  }

  const labels = ascii.split(".");
  if (labels.length < 2) {
    return { error: "single-label", ok: false };
  }
  if (!labels.every((label) => LABEL_PATTERN.test(label))) {
    return { error: "invalid-label", ok: false };
  }

  const appHost = options.appHost.trim().toLowerCase();
  if (ascii === appHost || ascii.endsWith(`.${appHost}`)) {
    return { error: "reserved-app-host", ok: false };
  }
  const cnameTarget = options.cnameTarget.trim().toLowerCase().replace(/\.$/, "");
  if (ascii === cnameTarget) {
    return { error: "reserved-target", ok: false };
  }

  return { hostname: ascii, ok: true };
}
