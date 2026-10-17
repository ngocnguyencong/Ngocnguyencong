"use server";

import { randomUUID } from "node:crypto";

import { parseServerConfig } from "@supastack/config";
import { AUDIT_ACTIONS, workspaceDomain } from "@supastack/db";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "../audit-runtime";
import { database } from "../auth-runtime";
import { emitWorkspaceEvent } from "../webhook-delivery";
import { requireWorkspaceManager } from "../workspace-access";
import { applyRemoteHostnameStatus, canAddDomain, type StoredDomainRow } from "./domains";
import { normalizeCustomHostname, type CustomHostnameRejection } from "./hostname";
import type { CustomHostname } from "./provider";
import {
  createCustomDomainProvider,
  invalidateDomainResolverCache,
  type CustomDomainsConfig,
} from "./runtime";

export interface WorkspaceDomainRow {
  cnameTarget: string;
  dcvRecords: {
    cname?: string;
    cnameTarget?: string;
    httpBody?: string;
    httpUrl?: string;
    status?: string;
    txtName?: string;
    txtValue?: string;
  }[];
  hostname: string;
  id: string;
  ownership?: { name: string; type: string; value: string };
  sslStatus: string | null;
  status: string;
}

export interface WorkspaceDomainsPage {
  cnameTarget: string | null;
  domains: WorkspaceDomainRow[];
  enabled: boolean;
  error?: string;
  manageable: boolean;
}

const HOSTNAME_ERROR_COPY: Record<CustomHostnameRejection, string> = {
  empty: "Enter a hostname.",
  "invalid-format": "Enter a bare hostname without scheme, port, or path.",
  "invalid-label": "Each label may use letters, digits, and hyphens (63 chars max).",
  "ip-address": "IP addresses cannot be custom domains.",
  localhost: "Localhost names cannot be custom domains.",
  "reserved-app-host": "That hostname belongs to this application.",
  "reserved-target": "That hostname is reserved for platform DNS.",
  "single-label": "Use a fully qualified domain like portal.example.com.",
  "too-long": "Hostnames are limited to 253 characters.",
  wildcard: "Wildcard hostnames are not supported.",
};

function toRow(row: StoredDomainRow, cnameTarget: string): WorkspaceDomainRow {
  const verification = row.verification;
  return {
    cnameTarget,
    dcvRecords: verification?.dcvRecords ?? [],
    hostname: row.hostname,
    id: row.id,
    ...(verification?.ownership === undefined ? {} : { ownership: verification.ownership }),
    sslStatus: row.sslStatus,
    status: row.status,
  };
}

function customDomainsConfig(): CustomDomainsConfig {
  return parseServerConfig().customDomains;
}

function appHost(): string {
  const webUrl = parseServerConfig().app.webUrl;
  try {
    return new URL(webUrl).hostname;
  } catch {
    return webUrl;
  }
}

export async function listWorkspaceDomains(): Promise<WorkspaceDomainsPage> {
  const config = customDomainsConfig();
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return {
      cnameTarget: config.kind === "off" ? null : config.cnameTarget,
      domains: [],
      enabled: config.kind !== "off",
      error: context.error,
      manageable: false,
    };
  }
  const rows = await database
    .select()
    .from(workspaceDomain)
    .where(eq(workspaceDomain.workspaceId, context.workspaceId))
    .orderBy(asc(workspaceDomain.hostname));
  return {
    cnameTarget: config.kind === "off" ? null : config.cnameTarget,
    domains: rows.map((row) => toRow(row, config.kind === "off" ? "" : config.cnameTarget)),
    enabled: config.kind !== "off",
    manageable: true,
  };
}

export type DomainActionResult = { error?: undefined; ok: true } | { error: string; ok: false };

async function recordVerification(
  context: { userId: string; workspaceId: string },
  domain: { hostname: string; id: string },
): Promise<void> {
  await recordAuditEvent({
    action: AUDIT_ACTIONS.workspaceDomainVerified,
    actorUserId: context.userId,
    metadata: { hostname: domain.hostname },
    targetId: domain.id,
    targetType: "workspace_domain",
    workspaceId: context.workspaceId,
  });
  try {
    await emitWorkspaceEvent({
      data: { domainId: domain.id, hostname: domain.hostname },
      eventType: "domain.verified",
      workspaceId: context.workspaceId,
    });
  } catch (error) {
    console.error("[custom-domains] domain.verified fan-out failed", {
      domainId: domain.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function addWorkspaceDomain(input: { hostname: string }): Promise<DomainActionResult> {
  const config = customDomainsConfig();
  if (config.kind === "off") {
    return { error: "Custom domains are not enabled on this deployment.", ok: false };
  }
  const wiring = createCustomDomainProvider(config);
  if (wiring === null) {
    return { error: "Custom domains are not enabled on this deployment.", ok: false };
  }
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { error: context.error, ok: false };
  }

  const normalized = normalizeCustomHostname(input.hostname, {
    appHost: appHost(),
    cnameTarget: wiring.cnameTarget,
  });
  if (!normalized.ok) {
    return { error: HOSTNAME_ERROR_COPY[normalized.error], ok: false };
  }
  const hostname = normalized.hostname;

  const domainId = `dom_${randomUUID()}`;
  let provisioned: CustomHostname | undefined;
  let created: { ok: true; remote: CustomHostname };
  try {
    const result = await database.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`custom-domain-create:${context.workspaceId}`}, 0))`,
      );
      const existingRows = await transaction
        .select({ value: count() })
        .from(workspaceDomain)
        .where(eq(workspaceDomain.workspaceId, context.workspaceId));
      if (!canAddDomain(existingRows[0]?.value ?? 0)) {
        return {
          error: "This workspace already has the maximum of 5 domains.",
          ok: false as const,
        };
      }
      const [conflict] = await transaction
        .select({ id: workspaceDomain.id })
        .from(workspaceDomain)
        .where(eq(workspaceDomain.hostname, hostname))
        .limit(1);
      if (conflict !== undefined) {
        return { error: "That hostname is already registered.", ok: false as const };
      }
      let remote: CustomHostname;
      try {
        remote = await wiring.provider.createHostname({
          hostname,
          metadata: { workspaceId: context.workspaceId },
        });
      } catch (error) {
        return {
          error:
            error instanceof Error ? error.message : "The domain provider rejected the hostname.",
          ok: false as const,
        };
      }
      provisioned = remote;
      const now = new Date();
      await transaction.insert(workspaceDomain).values({
        createdAt: now,
        hostname,
        id: domainId,
        lastCheckedAt: now,
        providerHostnameId: remote.id,
        sslStatus: remote.sslStatus,
        status: remote.status,
        updatedAt: now,
        verification: remote.verification,
        verifiedAt: remote.status === "active" ? now : null,
        workspaceId: context.workspaceId,
      });
      return { ok: true as const, remote };
    });
    if (!result.ok) return result;
    created = result;
  } catch (insertError) {
    // The provider hostname already exists — remove it so a failed insert
    // never leaves an orphaned remote record no local row can reach.
    if (provisioned !== undefined) {
      try {
        await wiring.provider.deleteHostname(provisioned.id);
      } catch (cleanupError) {
        console.error("[custom-domains] failed to remove orphaned provider hostname", {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          hostname,
          providerHostnameId: provisioned.id,
        });
      }
    }
    console.error("[custom-domains] domain insert failed", {
      error: insertError instanceof Error ? insertError.message : String(insertError),
      hostname,
    });
    return { error: "The domain could not be saved.", ok: false };
  }
  const { remote } = created;
  invalidateDomainResolverCache(hostname);

  await recordAuditEvent({
    action: AUDIT_ACTIONS.workspaceDomainAdded,
    actorUserId: context.userId,
    metadata: { hostname },
    targetId: domainId,
    targetType: "workspace_domain",
    workspaceId: context.workspaceId,
  });
  if (remote.status === "active") {
    await recordVerification(context, { hostname, id: domainId });
  }
  revalidatePath("/settings/domains");
  return { ok: true };
}

export async function refreshWorkspaceDomain(domainId: string): Promise<DomainActionResult> {
  const config = customDomainsConfig();
  const wiring = config.kind === "off" ? null : createCustomDomainProvider(config);
  if (wiring === null) {
    return { error: "Custom domains are not enabled on this deployment.", ok: false };
  }
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { error: context.error, ok: false };
  }

  const [row] = await database
    .select()
    .from(workspaceDomain)
    .where(
      and(eq(workspaceDomain.id, domainId), eq(workspaceDomain.workspaceId, context.workspaceId)),
    )
    .limit(1);
  if (row === undefined) {
    return { error: "Domain not found.", ok: false };
  }
  if (row.providerHostnameId === null) {
    return { error: "Domain has no provider record to refresh.", ok: false };
  }

  let remote: CustomHostname;
  try {
    remote = await wiring.provider.getHostname(row.providerHostnameId);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "The domain provider could not be reached.",
      ok: false,
    };
  }

  const { newlyVerified, patch } = applyRemoteHostnameStatus(row, remote, new Date());
  await database
    .update(workspaceDomain)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(eq(workspaceDomain.id, row.id), eq(workspaceDomain.workspaceId, context.workspaceId)),
    );
  invalidateDomainResolverCache(row.hostname);
  if (newlyVerified) {
    await recordVerification(context, { hostname: row.hostname, id: row.id });
  }
  revalidatePath("/settings/domains");
  return { ok: true };
}

export async function removeWorkspaceDomain(domainId: string): Promise<DomainActionResult> {
  const config = customDomainsConfig();
  const wiring = config.kind === "off" ? null : createCustomDomainProvider(config);
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { error: context.error, ok: false };
  }

  const [row] = await database
    .select()
    .from(workspaceDomain)
    .where(
      and(eq(workspaceDomain.id, domainId), eq(workspaceDomain.workspaceId, context.workspaceId)),
    )
    .limit(1);
  if (row === undefined) {
    return { error: "Domain not found.", ok: false };
  }

  // Whether the remote hostname is confirmed cleared once the local delete
  // runs — either there was never a provider link, or the provider delete
  // below succeeded (404 counts as gone). Only then may a failed DB delete
  // null the link; otherwise the row keeps it for a retry/reconciliation.
  const remoteCleared = row.providerHostnameId === null || wiring !== null;
  if (wiring !== null && row.providerHostnameId !== null) {
    try {
      await wiring.provider.deleteHostname(row.providerHostnameId);
    } catch (error) {
      // deleteHostname is idempotent for absent remote records, so an error
      // here means the remote hostname may still exist — keep the row (and
      // its provider link) so a retry or ops reconciliation can reach it.
      return {
        error:
          error instanceof Error
            ? error.message
            : "The domain provider could not delete the hostname.",
        ok: false,
      };
    }
  }
  try {
    await database
      .delete(workspaceDomain)
      .where(
        and(eq(workspaceDomain.id, row.id), eq(workspaceDomain.workspaceId, context.workspaceId)),
      );
  } catch (deleteError) {
    // The provider hostname is already deleted — clear the stale link so a
    // retry only retries the local delete instead of the remote call. When
    // the remote may still exist (provider off, or no link ever set), keep
    // the id so the remote record stays reachable.
    if (remoteCleared) {
      try {
        await database
          .update(workspaceDomain)
          .set({ providerHostnameId: null, updatedAt: new Date() })
          .where(
            and(
              eq(workspaceDomain.id, row.id),
              eq(workspaceDomain.workspaceId, context.workspaceId),
            ),
          );
      } catch {
        // Best-effort link cleanup; the original failure is what matters.
      }
    }
    console.error("[custom-domains] domain delete failed", {
      domainId: row.id,
      error: deleteError instanceof Error ? deleteError.message : String(deleteError),
    });
    return { error: "The domain could not be removed.", ok: false };
  }
  invalidateDomainResolverCache(row.hostname);
  await recordAuditEvent({
    action: AUDIT_ACTIONS.workspaceDomainRemoved,
    actorUserId: context.userId,
    metadata: { hostname: row.hostname },
    targetId: row.id,
    targetType: "workspace_domain",
    workspaceId: context.workspaceId,
  });
  revalidatePath("/settings/domains");
  return { ok: true };
}
