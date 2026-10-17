import { createHash, randomBytes, randomUUID } from "node:crypto";

export function sdSiteId(): string {
  return "sdid_" + randomBytes(12).toString("hex");
}

export function sdShareId(): string {
  return randomBytes(12).toString("hex");
}

/** Full secret (returned once). Store only the hash + display prefix. */
export function newSiteKey(): { key: string; prefix: string; hash: string } {
  const key = "sd_" + randomBytes(24).toString("hex");
  return { key, prefix: key.slice(0, 11) + "…", hash: sha256(key) };
}

export function sdId(): string {
  return randomUUID();
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Cookieless daily-rotating visitor key: hash(siteId + ip + ua + date). */
export function dailyVisitorKey(siteId: string, ip: string, ua: string, date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return sha256(`${siteId}|${ip}|${ua}|${day}`).slice(0, 32);
}
