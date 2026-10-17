import { createHmac } from "node:crypto";

export { WEBHOOK_EVENTS, isWebhookEventType, type WebhookEventType } from "./webhook-events";

/**
 * Endpoint URLs must be exact http(s) URLs with no embedded credentials.
 * Production requires https and a publicly routable host; local development
 * may target http hosts (including localhost receivers).
 */
export function isValidWebhookEndpointUrl(value: string, production: boolean): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return false;
  }
  if (url.username !== "" || url.password !== "") {
    return false;
  }
  if (production) {
    if (url.protocol !== "https:") {
      return false;
    }
    // SSRF guard: the delivery worker POSTs signed workspace payloads to this
    // host — private/link-local targets would reach internal services.
    if (!isPubliclyRoutableHost(url.hostname)) {
      return false;
    }
  }
  return true;
}

/**
 * Parses an IPv4 literal in inet_aton/WHATWG form — 1-4 dot-separated parts
 * where each part is decimal, `0`-prefixed octal, or `0x` hex, and the last
 * part spans the remaining bytes (`127.1`, `2130706433` are loopback).
 * Returns the 4 address bytes or null when `host` is not an IPv4 literal.
 */
function parseIpv4(host: string): [number, number, number, number] | null {
  const parts = host.split(".");
  if (parts.length > 4) {
    return null;
  }
  const numbers: number[] = [];
  for (const part of parts) {
    let value: number;
    if (/^0x[0-9a-f]+$/i.test(part)) {
      value = Number.parseInt(part, 16);
    } else if (/^0[0-7]+$/.test(part)) {
      value = Number.parseInt(part, 8);
    } else if (/^(?:0|[1-9][0-9]*)$/.test(part)) {
      value = Number.parseInt(part, 10);
    } else {
      return null;
    }
    if (value > 0xff_ff_ff_ff) {
      return null;
    }
    numbers.push(value);
  }
  const last = numbers[numbers.length - 1]!;
  const tailWidth = 5 - numbers.length;
  if (last >= 256 ** tailWidth || numbers.slice(0, -1).some((n) => n > 255)) {
    return null;
  }
  const tail: number[] = [];
  for (let rest = last, i = 0; i < tailWidth; i += 1) {
    tail.unshift(rest % 256);
    rest = Math.floor(rest / 256);
  }
  return [...numbers.slice(0, -1), ...tail] as [number, number, number, number];
}

/**
 * Parses an IPv6 literal (no brackets, optional zone id stripped) into its
 * 16 bytes. Embedded IPv4 tails (`::ffff:a.b.c.d`) expand into two groups.
 */
function parseIpv6(input: string): number[] | null {
  let value = input;
  const zone = value.indexOf("%");
  if (zone !== -1) {
    value = value.slice(0, zone);
  }
  if (value.includes(".")) {
    const lastColon = value.lastIndexOf(":");
    const embedded = lastColon === -1 ? null : parseIpv4(value.slice(lastColon + 1));
    if (embedded === null) {
      return null;
    }
    const hi = ((embedded[0] << 8) | embedded[1]).toString(16);
    const lo = ((embedded[2] << 8) | embedded[3]).toString(16);
    value = `${value.slice(0, lastColon)}:${hi}:${lo}`;
  }
  const halves = value.split("::");
  if (halves.length > 2) {
    return null;
  }
  const left = halves[0] === "" ? [] : halves[0]!.split(":");
  const right = halves.length === 2 ? (halves[1] === "" ? [] : halves[1]!.split(":")) : [];
  // `::` must elide at least one group; without it exactly 8 are required.
  if (halves.length === 1 ? left.length !== 8 : left.length + right.length >= 8) {
    return null;
  }
  const parts = [...left, ...right];
  if (parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) {
    return null;
  }
  const groups = [...left, ...Array<string>(8 - left.length - right.length).fill("0"), ...right];
  return groups.flatMap((group) => {
    const parsed = Number.parseInt(group, 16);
    return [(parsed >> 8) & 0xff, parsed & 0xff];
  });
}

/** RFC1918/link-local/CGNAT/doc/multicast/reserved — never a webhook target. */
function isPublicIpv4(bytes: readonly number[]): boolean {
  const [a = 0, b = 0, c = 0] = bytes;
  if (a === 0 || a === 10 || a === 127) {
    return false; // this-net, private /8, loopback
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return false; // 100.64.0.0/10 CGNAT
  }
  if (a === 169 && b === 254) {
    return false; // link-local incl. cloud metadata 169.254.169.254
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return false; // 172.16.0.0/12 private
  }
  if (a === 192 && b === 0 && (c === 0 || c === 2)) {
    return false; // 192.0.0.0/24 protocol assignments, 192.0.2.0/24 doc
  }
  if (a === 192 && b === 168) {
    return false; // private /16
  }
  if (a === 198 && (b === 18 || b === 19)) {
    return false; // 198.18.0.0/15 benchmark
  }
  if (a === 198 && b === 51 && c === 100) {
    return false; // 198.51.100.0/24 doc
  }
  if (a === 203 && b === 0 && c === 113) {
    return false; // 203.0.113.0/24 doc
  }
  if (a >= 224) {
    return false; // 224/4 multicast, 240/4 reserved, 255.255.255.255 broadcast
  }
  return true;
}

function isPublicIpv6(bytes: readonly number[]): boolean {
  const [b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, , , b8 = 0, b9 = 0, b10 = 0, b11 = 0] =
    bytes;
  const zeros = (start: number, end: number) => bytes.slice(start, end).every((b) => b === 0);
  // ::/96 (v4-compatible, includes :: and ::1) and ::ffff:/96 (v4-mapped)
  // embed a v4 address in the last 32 bits — re-check it against the v4 rules.
  if (zeros(0, 12) || (zeros(0, 10) && b10 === 0xff && b11 === 0xff)) {
    return isPublicIpv4(bytes.slice(12));
  }
  if (zeros(0, 8) && b8 === 0xff && b9 === 0xff && zeros(10, 12)) {
    return false; // ::ffff:0:0/96 deprecated v4-translated — reserved
  }
  if (b0 === 0x00 && b1 === 0x64 && b2 === 0xff && b3 === 0x9b && zeros(4, 12)) {
    return false; // 64:ff9b::/96 NAT64 well-known — embeds a translated v4
  }
  if (b0 === 0x00 && b1 === 0x64 && b2 === 0xff && b3 === 0x9b && b4 === 0x00 && b5 === 0x01) {
    return false; // 64:ff9b:1::/48 NAT64 local-use (RFC 8215)
  }
  if (b0 === 0x20 && b1 === 0x01 && b2 === 0x00 && b3 === 0x00) {
    return false; // 2001::/32 Teredo — embeds an obfuscated v4
  }
  if (b0 === 0x20 && b1 === 0x02) {
    return false; // 2002::/16 6to4 — relays toward an embedded v4
  }
  if (b0 === 0xfe && (b1 & 0xc0) === 0x80) {
    return false; // fe80::/10 link-local
  }
  if ((b0 & 0xfe) === 0xfc) {
    return false; // fc00::/7 unique-local
  }
  if (b0 === 0xff) {
    return false; // ff00::/8 multicast
  }
  if (b0 === 0x20 && b1 === 0x01 && b2 === 0x0d && b3 === 0xb8) {
    return false; // 2001:db8::/32 documentation
  }
  return true;
}

/**
 * WHATWG URL hostnames keep IPv6 literal brackets (`[::1]`); `dns.lookup`
 * and display paths want them off.
 */
export function stripIpv6Brackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

/** Intranet-style suffixes that must never be webhook targets in production. */
const BLOCKED_HOST_SUFFIXES = [
  "corp",
  "home",
  "home.arpa",
  "internal",
  "lan",
  "local",
  "localhost",
] as const;

/**
 * SSRF guard shared by registration validation and delivery-time DNS
 * re-checks: true only when the host is a publicly routable target.
 * `hostname` accepts a WHATWG URL hostname (IPv6 literals keep their
 * brackets) or a bare `dns.lookup` address. IPv4-mapped/embedded IPv6 is
 * re-checked against the IPv4 ranges; hostnames without a dot
 * (single-label intranet names) and `*.internal`-style suffixes — which
 * also cover `metadata.google.internal` — are rejected.
 */
export function isPubliclyRoutableHost(hostname: string): boolean {
  let host = hostname.trim().toLowerCase();
  while (host.endsWith(".")) {
    host = host.slice(0, -1);
  }
  if (host === "") {
    return false;
  }
  const literal = stripIpv6Brackets(host);
  if (literal.includes(":")) {
    const bytes = parseIpv6(literal);
    return bytes !== null && isPublicIpv6(bytes);
  }
  const ipv4 = parseIpv4(literal);
  if (ipv4 !== null) {
    return isPublicIpv4(ipv4);
  }
  if (!host.includes(".")) {
    return false; // single-label intranet names (https://metadata/)
  }
  return !BLOCKED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/** Stripe-style signature: `t=<unix seconds>,v1=<hmac-sha256 of t.body>`. */
export function signWebhookPayload(secret: string, timestampSeconds: number, body: string): string {
  const signature = createHmac("sha256", secret)
    .update(`${timestampSeconds}.${body}`)
    .digest("hex");
  return `t=${timestampSeconds},v1=${signature}`;
}

export interface WebhookPayload {
  /** Opaque `corr_<uuid>` joining this delivery to the emitting request's telemetry chain. */
  correlationId?: string;
  createdAt: string;
  data: Record<string, unknown>;
  id: string;
  type: string;
  workspaceId: string;
}

export function buildWebhookPayload(input: {
  correlationId?: string;
  data: Record<string, unknown>;
  eventType: string;
  id: string;
  timestamp: Date;
  workspaceId: string;
}): WebhookPayload {
  return {
    ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
    createdAt: input.timestamp.toISOString(),
    data: input.data,
    id: input.id,
    type: input.eventType,
    workspaceId: input.workspaceId,
  };
}

const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 1_800_000] as const;
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

/**
 * Next retry time after the given attempt count (1-based). Returns null when
 * the delivery should be marked permanently failed.
 */
export function nextWebhookRetryAt(attempts: number, now: Date): Date | null {
  if (attempts >= MAX_ATTEMPTS) {
    return null;
  }
  const delay = RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length) - 1] ?? 60_000;
  return new Date(now.getTime() + delay);
}
