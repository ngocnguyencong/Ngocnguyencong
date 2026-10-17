import { openApiDocument, type SupastackOpenApiDocument } from "@supastack/api";

/** Access classification — the page maps kinds to localized labels. */
export type ApiReferenceAccess = "session-or-key" | "public";

export type ApiReferenceEndpoint = {
  /** Uppercase HTTP method — GET, POST, DELETE, … */
  method: string;
  /** Route template as published, e.g. /api/v1/ai-tasks/{taskId}. */
  path: string;
  /** One-line operation summary from the OpenAPI document. */
  summary: string;
  /** Access kind — rendered through `RESOURCE_COPY[].apiReference.accessLabels`. */
  auth: ApiReferenceAccess;
};

export type ApiReferenceGroup = {
  tag: string;
  endpoints: ApiReferenceEndpoint[];
};

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];

/** Untagged operations collect under one fallback section. */
const UNTAGGED = "General";

/**
 * Access classification for one operation. Every registered /api/v1 route
 * resolves a Bearer `sk_` key first and falls back to the app session, so
 * that is the default; an explicit empty `security: []` (or an operation
 * outside the authenticated surface) classifies as public. The page maps
 * kinds to localized labels via `RESOURCE_COPY`.
 */
function authAccessFor(operation: { security?: unknown }): ApiReferenceAccess {
  return Array.isArray(operation.security) && operation.security.length === 0
    ? "public"
    : "session-or-key";
}

/**
 * Flatten the generated OpenAPI document into tag-grouped rows for rendering.
 * Reading the document keeps the page in step with the registered routes —
 * no hand-maintained endpoint list to drift.
 */
export function apiReferenceGroups(
  document: SupastackOpenApiDocument = openApiDocument,
): ApiReferenceGroup[] {
  const groups = new Map<string, ApiReferenceEndpoint[]>();
  for (const [path, item] of Object.entries(document.paths)) {
    if (!item) continue;
    for (const [method, operation] of Object.entries(item)) {
      if (!HTTP_METHODS.includes(method)) continue;
      // PathItem entries can be present-but-empty ({ get: undefined }) —
      // skip anything that isn't a real operation object.
      if (!operation || typeof operation !== "object") continue;
      const op = operation as {
        summary?: string;
        description?: string;
        tags?: string[];
        security?: unknown;
      };
      const endpoint: ApiReferenceEndpoint = {
        method: method.toUpperCase(),
        path,
        summary: op.summary ?? op.description ?? "",
        auth: authAccessFor(op),
      };
      for (const tag of op.tags?.length ? op.tags : [UNTAGGED]) {
        const list = groups.get(tag) ?? [];
        list.push(endpoint);
        groups.set(tag, list);
      }
    }
  }
  return [...groups.entries()].map(([tag, endpoints]) => ({ tag, endpoints }));
}
