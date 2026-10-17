import { timingSafeEqual } from "node:crypto";
import { readBoundedText, RequestBodyTooLargeError } from "./request-body";

export function createRevenueCatWebhookHandler(dependencies: {
  authorization: string | null;
  syncCustomer(customerId: string): Promise<void>;
}) {
  return async (request: Request): Promise<Response> => {
    if (!dependencies.authorization)
      return Response.json({ error: "Purchases unavailable." }, { status: 503 });
    if (
      !verifyRevenueCatAuthorization(
        request.headers.get("authorization"),
        dependencies.authorization,
      )
    ) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }
    let customers: string[];
    try {
      customers = webhookCustomerIds(JSON.parse(await readBoundedText(request, 65_536)) as unknown);
    } catch (error) {
      return Response.json(
        { error: "Invalid purchase notification." },
        { status: error instanceof RequestBodyTooLargeError ? 413 : 400 },
      );
    }
    try {
      for (const customerId of customers) await dependencies.syncCustomer(customerId);
      return Response.json({ ok: true });
    } catch {
      return Response.json(
        { error: "Purchases could not be verified. Try again." },
        { status: 503 },
      );
    }
  };
}

/** A routing identity, never an authorization credential. */
export function purchaseCustomerId(workspaceId: string): string {
  return `ssws_${Buffer.from(workspaceId, "utf8").toString("base64url")}`;
}

export function purchaseWorkspaceId(customerId: string): string | null {
  if (!/^ssws_[A-Za-z0-9_-]{1,1024}$/.test(customerId)) return null;
  const workspaceId = Buffer.from(customerId.slice(5), "base64url").toString("utf8");
  if (
    !workspaceId ||
    workspaceId.length > 255 ||
    [...workspaceId].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 0xfffd,
    )
  )
    return null;
  return purchaseCustomerId(workspaceId) === customerId ? workspaceId : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function verificationFailed(): never {
  throw new Error("Purchase verification failed.");
}

function providerDate(value: unknown): Date | null {
  if (value === null) return null;
  if (typeof value !== "string") return verificationFailed();
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : verificationFailed();
}

/** Only a server-fetched subscriber payload may enter this predicate. */
export function parseRevenueCatAccess(
  payload: unknown,
  entitlementId: string,
  allowSandbox: boolean,
  now = new Date(),
): { active: boolean; expiresAt: Date | null } {
  const subscriber = record(record(payload)?.subscriber);
  const entitlements = record(subscriber?.entitlements);
  if (!subscriber || !entitlements) return verificationFailed();
  const denied = { active: false, expiresAt: null };
  const rawGrant = entitlements[entitlementId];
  if (rawGrant === undefined) return denied;
  const grant = record(rawGrant);
  if (!grant || typeof grant.product_identifier !== "string") return verificationFailed();
  const expiration = providerDate(grant.expires_date);
  const subscriptions = record(subscriber.subscriptions);
  const nonSubscriptions = record(subscriber.non_subscriptions);
  const subscription = record(subscriptions?.[grant.product_identifier]);
  const graceDate = subscription?.grace_period_expires_date ?? grant.grace_period_expires_date;
  const grace = graceDate == null ? null : providerDate(graceDate);
  const expiresAt = expiration && grace && grace > expiration ? grace : expiration;
  const purchases = nonSubscriptions?.[grant.product_identifier];
  const evidence = subscription
    ? [subscription]
    : Array.isArray(purchases)
      ? purchases.map(record)
      : [];
  const verified = evidence.some(
    (purchase) =>
      purchase &&
      typeof purchase.is_sandbox === "boolean" &&
      (allowSandbox || !purchase.is_sandbox) &&
      purchase.refunded_at == null,
  );
  return { active: verified && (expiresAt === null || expiresAt > now), expiresAt };
}

export function verifyRevenueCatAuthorization(actual: string | null, expected: string): boolean {
  if (!actual || !expected || actual.length > 2048) return false;
  const left = Buffer.from(actual),
    right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Events trigger a current-state read; their entitlement claims never grant access. */
export function webhookCustomerIds(payload: unknown): string[] {
  const event = record(record(payload)?.event);
  if (!event || typeof event.id !== "string" || typeof event.type !== "string")
    return verificationFailed();
  if (event.type === "TEST") return [];
  const candidates = [
    event.app_user_id,
    ...[event.aliases, event.transferred_from, event.transferred_to].flatMap((value) =>
      Array.isArray(value) ? (value as unknown[]) : [],
    ),
  ];
  if (candidates.length > 64) return verificationFailed();
  return [
    ...new Set(
      candidates.filter(
        (value): value is string =>
          typeof value === "string" && purchaseWorkspaceId(value) !== null,
      ),
    ),
  ];
}

type PurchaseResponse = {
  status: number;
  body: { data?: Record<string, unknown>; error?: { code: string; message: string } };
};
const failure = (status: number, code: string, message: string): PurchaseResponse => ({
  status,
  body: { error: { code, message } },
});
const unavailable = () =>
  failure(503, "unavailable", "Purchases could not be verified. Try again.");

export function createMobilePurchasesBff(dependencies: {
  entitlementId: string | null;
  getSession(headers: Headers): Promise<{ user: { id: string } } | null>;
  resolveWorkspace(userId: string): Promise<{ workspaceId: string; role: string } | null>;
  syncWorkspace(workspaceId: string): Promise<{ active: boolean }>;
}) {
  async function context(headers: Headers) {
    const session = await dependencies.getSession(headers);
    if (!session) return failure(401, "unauthorized", "Sign in before managing purchases.");
    const scope = await dependencies.resolveWorkspace(session.user.id);
    if (!scope) return failure(403, "forbidden", "Workspace membership required.");
    return scope;
  }
  return {
    async get(headers: Headers): Promise<PurchaseResponse> {
      try {
        const scope = await context(headers);
        if ("status" in scope) return scope;
        const available =
          dependencies.entitlementId !== null && (scope.role === "owner" || scope.role === "admin");
        return {
          status: 200,
          body: {
            data: {
              available,
              appUserId: available ? purchaseCustomerId(scope.workspaceId) : null,
              entitlementId: available ? dependencies.entitlementId : null,
              workspaceId: scope.workspaceId,
            },
          },
        };
      } catch {
        return unavailable();
      }
    },
    async post(headers: Headers): Promise<PurchaseResponse> {
      try {
        const scope = await context(headers);
        if ("status" in scope) return scope;
        if (scope.role !== "owner" && scope.role !== "admin")
          return failure(403, "forbidden", "Owner or admin role required.");
        if (dependencies.entitlementId === null) return unavailable();
        const { active } = await dependencies.syncWorkspace(scope.workspaceId);
        return { status: 200, body: { data: { active, workspaceId: scope.workspaceId } } };
      } catch {
        return unavailable();
      }
    },
  };
}
