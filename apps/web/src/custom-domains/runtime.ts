import "server-only";

import { parseServerConfig, type ServerConfig } from "@supastack/config";
import { storedObject, workspace, workspaceDomain } from "@supastack/db";
import { and, desc, eq } from "drizzle-orm";

import { database } from "../auth-runtime";
import { createServerObjectStorage } from "../storage-runtime";
import { createCloudflareDomainClient } from "./cloudflare-client";
import { createDomainResolver, type ResolvedDomainBrand } from "./domain-resolver";
import { createLocalDomainClient } from "./local-client";
import type { CustomDomainProvider } from "./provider";

/**
 * Server-side composition for custom domains. Everything funnels through
 * `serverConfig.customDomains`; with `CUSTOM_DOMAINS_PROVIDER=off` every
 * export degrades to a no-op so the rest of the app stays oblivious.
 */

export type CustomDomainsConfig = ServerConfig["customDomains"];

export function customDomainsEnabled(config: CustomDomainsConfig): boolean {
  return config.kind !== "off";
}

export function createCustomDomainProvider(
  config: CustomDomainsConfig,
): { provider: CustomDomainProvider; cnameTarget: string } | null {
  if (config.kind === "cloudflare") {
    return {
      cnameTarget: config.cnameTarget,
      provider: createCloudflareDomainClient({
        apiToken: config.apiToken,
        cnameTarget: config.cnameTarget,
        zoneId: config.zoneId,
      }),
    };
  }
  if (config.kind === "local") {
    return {
      cnameTarget: config.cnameTarget,
      provider: createLocalDomainClient({ cnameTarget: config.cnameTarget }),
    };
  }
  return null;
}

async function lookupActiveDomain(host: string): Promise<ResolvedDomainBrand | null> {
  const [row] = await database
    .select({ name: workspace.name, workspaceId: workspaceDomain.workspaceId })
    .from(workspaceDomain)
    .innerJoin(workspace, eq(workspace.id, workspaceDomain.workspaceId))
    .where(and(eq(workspaceDomain.hostname, host), eq(workspaceDomain.status, "active")))
    .limit(1);
  if (row === undefined) {
    return null;
  }
  const [logo] = await database
    .select({ objectKey: storedObject.objectKey })
    .from(storedObject)
    .where(and(eq(storedObject.workspaceId, row.workspaceId), eq(storedObject.purpose, "logo")))
    .orderBy(desc(storedObject.createdAt))
    .limit(1);
  return {
    logoObjectKey: logo?.objectKey ?? null,
    name: row.name,
    workspaceId: row.workspaceId,
  };
}

const resolver = createDomainResolver({ lookupActiveDomain });

/** Resolves a request host to the owning workspace's brand, or null. */
export async function resolveWorkspaceByHost(host: string): Promise<ResolvedDomainBrand | null> {
  const config = parseServerConfig().customDomains;
  if (!customDomainsEnabled(config)) {
    return null;
  }
  return resolver.resolve(host);
}

export function invalidateDomainResolverCache(host?: string): void {
  resolver.invalidate(host);
  trustedOriginsCache = null;
}

export interface RequestBrand {
  logoUrl: string | null;
  name: string;
}

export const DEFAULT_BRAND: RequestBrand = Object.freeze({ logoUrl: null, name: "supastack" });

/**
 * Brand for the current request host: a verified custom domain's workspace
 * name/logo when the host resolves, else the site default. Reads the `host`
 * header; safe to call from any server component or metadata function.
 */
export async function getRequestBrand(headerList?: Headers): Promise<RequestBrand> {
  const config = parseServerConfig().customDomains;
  if (!customDomainsEnabled(config)) {
    return DEFAULT_BRAND;
  }
  let list = headerList;
  if (list === undefined) {
    try {
      list = await (await import("next/headers")).headers();
    } catch {
      // Outside a request scope (metadata build, scripts) — default brand.
      return DEFAULT_BRAND;
    }
  }
  const host = list.get("x-forwarded-host") ?? list.get("host");
  if (host === null || host.length === 0) {
    return DEFAULT_BRAND;
  }
  const brand = await resolver.resolve(host);
  if (brand === null) {
    return DEFAULT_BRAND;
  }
  const storage = createServerObjectStorage();
  return {
    logoUrl:
      brand.logoObjectKey === null
        ? null
        : storage.getPublicUrl({ key: brand.logoObjectKey, workspaceId: brand.workspaceId }),
    name: brand.name,
  };
}

let trustedOriginsCache: { expiresAt: number; value: string[] } | null = null;

/**
 * `https://` origins for every active custom domain — fed into Better Auth's
 * request-aware `trustedOrigins` callback. Cached for the resolver TTL so
 * auth traffic does not hit the database per request.
 */
export async function resolveTrustedDomainOrigins(): Promise<string[]> {
  const config = parseServerConfig().customDomains;
  if (!customDomainsEnabled(config)) {
    return [];
  }
  if (trustedOriginsCache !== null && trustedOriginsCache.expiresAt > Date.now()) {
    return trustedOriginsCache.value;
  }
  const rows = await database
    .select({ hostname: workspaceDomain.hostname })
    .from(workspaceDomain)
    .where(eq(workspaceDomain.status, "active"));
  const value = rows.map((row) => `https://${row.hostname}`);
  trustedOriginsCache = { expiresAt: Date.now() + 60_000, value };
  return value;
}
