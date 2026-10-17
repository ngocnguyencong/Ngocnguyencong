import {
  CustomDomainProviderError,
  type CustomDomainProvider,
  type CustomDomainStatus,
  type CustomHostname,
  type DomainVerificationRecord,
} from "./provider";

/**
 * Cloudflare for SaaS custom hostnames over the v4 REST API
 * (`POST/GET/DELETE /client/v4/zones/{zone}/custom_hostnames[/id]`).
 * The API token never appears in error messages — Cloudflare error payloads
 * are filtered to generic entries before surfacing.
 */

const API_BASE = "https://api.cloudflare.com/client/v4";

type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;

interface CloudflareEnvelope {
  errors?: { code?: number; message?: string }[];
  result?: unknown;
  success?: boolean;
}

const ACTIVE_STATUSES = new Set([
  "active",
  "active_redeploying",
  "provisioned",
  "test_active",
  "test_active_apex",
]);
const PENDING_STATUSES = new Set([
  "pending",
  "pending_migration",
  "pending_provisioned",
  "test_pending",
]);
const FAILED_STATUSES = new Set(["blocked", "pending_blocked", "test_blocked", "test_failed"]);

function normalizeStatus(status: unknown): CustomDomainStatus {
  if (typeof status !== "string") return "pending";
  if (ACTIVE_STATUSES.has(status)) return "active";
  if (status === "moved") return "moved";
  if (status === "deleted" || status === "pending_deletion") return "deleted";
  if (FAILED_STATUSES.has(status)) return "failed";
  if (PENDING_STATUSES.has(status)) return "pending";
  return "pending";
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function mapDcvRecord(value: unknown): DomainVerificationRecord {
  const entry = record(value);
  const out: DomainVerificationRecord = {};
  const cname = stringOrUndefined(entry.cname);
  const cnameTarget = stringOrUndefined(entry.cname_target);
  const httpBody = stringOrUndefined(entry.http_body);
  const httpUrl = stringOrUndefined(entry.http_url);
  const status = stringOrUndefined(entry.status);
  const txtName = stringOrUndefined(entry.txt_name);
  const txtValue = stringOrUndefined(entry.txt_value);
  if (cname !== undefined) out.cname = cname;
  if (cnameTarget !== undefined) out.cnameTarget = cnameTarget;
  if (httpBody !== undefined) out.httpBody = httpBody;
  if (httpUrl !== undefined) out.httpUrl = httpUrl;
  if (status !== undefined) out.status = status;
  if (txtName !== undefined) out.txtName = txtName;
  if (txtValue !== undefined) out.txtValue = txtValue;
  return out;
}

function mapHostname(result: unknown, cnameTarget: string): CustomHostname {
  const entry = record(result);
  const ssl = record(entry.ssl);
  const ownership = record(entry.ownership_verification);
  const records = Array.isArray(ssl.validation_records) ? ssl.validation_records : [];

  const hostname: CustomHostname = {
    hostname: typeof entry.hostname === "string" ? entry.hostname : "",
    id: typeof entry.id === "string" ? entry.id : "",
    sslStatus: typeof ssl.status === "string" ? ssl.status : null,
    status: normalizeStatus(entry.status),
    verification: {
      cnameTarget,
      dcvRecords: records.map(mapDcvRecord),
      ...(typeof ownership.name === "string"
        ? {
            ownership: {
              name: ownership.name,
              type: typeof ownership.type === "string" ? ownership.type : "txt",
              value: typeof ownership.value === "string" ? ownership.value : "",
            },
          }
        : {}),
    },
  };
  return hostname;
}

export function createCloudflareDomainClient(options: {
  apiToken: string;
  cnameTarget: string;
  fetch?: FetchLike;
  zoneId: string;
}): CustomDomainProvider {
  const fetchImpl: FetchLike = options.fetch ?? ((url, init) => fetch(url, init));
  const zone = encodeURIComponent(options.zoneId);

  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetchImpl(`${API_BASE}/zones/${zone}/custom_hostnames${path}`, {
      headers: {
        authorization: `Bearer ${options.apiToken}`,
        "content-type": "application/json",
      },
      method,
      signal: AbortSignal.timeout(10_000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    let envelope: CloudflareEnvelope;
    try {
      envelope = (await response.json()) as CloudflareEnvelope;
    } catch {
      throw new CustomDomainProviderError(`Cloudflare request failed (${response.status}).`, {
        status: response.status,
      });
    }

    if (!response.ok || envelope.success !== true) {
      const messages = (envelope.errors ?? [])
        .map((error) => (typeof error.message === "string" ? error.message : ""))
        // Cloudflare occasionally echoes request material into errors; never
        // surface a message that contains the API token.
        .filter((message) => message.length > 0 && !message.includes(options.apiToken));
      throw new CustomDomainProviderError(
        messages[0] ?? `Cloudflare request failed (${response.status}).`,
        { status: response.status },
      );
    }
    return envelope.result;
  }

  return {
    async createHostname(input) {
      const result = await request("POST", "", {
        custom_metadata: input.metadata,
        hostname: input.hostname,
        ssl: { method: "txt", settings: { min_tls_version: "1.2" }, type: "dv" },
      });
      return mapHostname(result, options.cnameTarget);
    },
    async deleteHostname(id) {
      try {
        await request("DELETE", `/${encodeURIComponent(id)}`);
      } catch (error) {
        // A 404 means the hostname is already gone — deleting an absent
        // resource is the desired end state, so treat it as success.
        if (error instanceof CustomDomainProviderError && error.status === 404) {
          return;
        }
        throw error;
      }
    },
    async getHostname(id) {
      const result = await request("GET", `/${encodeURIComponent(id)}`);
      return mapHostname(result, options.cnameTarget);
    },
  };
}
