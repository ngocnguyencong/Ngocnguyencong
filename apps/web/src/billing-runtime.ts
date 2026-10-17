import "server-only";

import {
  CreemBillingAdapter,
  DodoBillingAdapter,
  LemonSqueezyBillingAdapter,
  PaddleBillingAdapter,
  PaypalBillingAdapter,
  PolarBillingAdapter,
  StripeBillingAdapter,
  WhopBillingAdapter,
} from "@supastack/billing";
import type { ServerConfig } from "@supastack/config";
import { parseServerConfig } from "@supastack/config";
import {
  createDrizzleRepositoryExecutor,
  createWorkspaceRepositories,
  MAX_CREDIT_AMOUNT,
  normalizeWorkspaceRole,
  workspace,
  workspaceMembership,
} from "@supastack/db";
import { eq } from "drizzle-orm";

import { readActiveWorkspaceCookie, resolveBillingWorkspaceId } from "./active-workspace";
import { database, getAuthSession } from "./auth-runtime";
import { createBillingBff, createStableCheckoutIdentity } from "./billing-bff";
import { grantWorkspaceCredits } from "./credits";
import { PRODUCT_PLANS, productPlanPriceMapFromEnv } from "./product-plans";
import { createServerBillingAdapter } from "./server-provider-composition";

const serverConfig = parseServerConfig();
const billingAdapter = createServerBillingAdapter(serverConfig.providers.billing);
const repositories = createWorkspaceRepositories(createDrizzleRepositoryExecutor(database));

type CredentialedBillingConfig = Extract<
  ServerConfig["providers"]["billing"],
  {
    kind: "creem" | "dodo" | "lemonsqueezy" | "paddle" | "paypal" | "polar" | "stripe" | "whop";
  }
>;

function buildBillingBff(
  provider: CredentialedBillingConfig,
  adapter:
    | CreemBillingAdapter
    | DodoBillingAdapter
    | LemonSqueezyBillingAdapter
    | PaddleBillingAdapter
    | PaypalBillingAdapter
    | PolarBillingAdapter
    | StripeBillingAdapter
    | WhopBillingAdapter,
) {
  return createBillingBff({
    applyStripeBillingEvent: repositories.applyStripeBillingEvent,
    billing: adapter,
    config: {
      appUrl: serverConfig.app.webUrl,
      entitlement: "ai.reference-task",
      priceId: provider.priceId,
      priceMap: productPlanPriceMapFromEnv(process.env, provider.kind),
      provider: provider.kind,
      webhookSecret: provider.webhookSecret,
    },
    createCheckoutIdentity: createStableCheckoutIdentity,
    findBillingContext: async (userId, headers) => {
      const memberships = await database
        .select({
          role: workspaceMembership.role,
          workspaceId: workspace.id,
          workspaceType: workspace.type,
        })
        .from(workspaceMembership)
        .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
        .where(eq(workspaceMembership.userId, userId));

      const preference = await database.query.userWorkspacePreference.findFirst({
        columns: { activeWorkspaceId: true },
        where: (fields, { eq: equals }) => equals(fields.userId, userId),
      });

      const workspaceId = resolveBillingWorkspaceId({
        cookieWorkspaceId: readActiveWorkspaceCookie(headers.get("cookie")),
        preferredWorkspaceId: preference?.activeWorkspaceId ?? null,
        memberships: memberships.map((row) => ({
          role: row.role,
          workspaceId: row.workspaceId,
          workspaceType: row.workspaceType === "organization" ? "organization" : "personal",
        })),
      });

      const account = await database.query.user.findFirst({
        columns: { email: true },
        where: (fields, { eq: equals }) => equals(fields.id, userId),
      });

      if (workspaceId === null || account === undefined) {
        return null;
      }

      const customer = await repositories.readBillingCustomer({
        provider: provider.kind,
        workspaceId,
      });

      return {
        customerId: customer?.providerCustomerId ?? null,
        email: account.email,
        role: normalizeWorkspaceRole(
          memberships.find((row) => row.workspaceId === workspaceId)?.role,
        ),
        workspaceId,
      };
    },
    getSession: async (headers) => getAuthSession(headers),
    now: () => new Date(),
    onEntitlementActivated: async ({ entitlementKey, eventId, subscriptionId, workspaceId }) => {
      const plan = PRODUCT_PLANS.find((entry) => entry.entitlement === entitlementKey);
      const grant = plan?.creditGrant;
      if (
        plan === undefined ||
        typeof grant !== "number" ||
        !Number.isInteger(grant) ||
        grant <= 0 ||
        grant > MAX_CREDIT_AMOUNT
      ) {
        return;
      }
      // Subscription-scoped reference: replays of this event AND any later
      // active-status lifecycle events for the same subscription dedupe to a
      // single grant. Only a brand-new subscription re-grants.
      await grantWorkspaceCredits({
        amount: grant,
        reason: `plan credit grant (${plan.id})`,
        referenceId: `plan-credit:${provider.kind}:${subscriptionId ?? eventId}`,
        workspaceId,
      });
    },
    onBillingLifecycleProcessed: async (event, context) => {
      const { tryEmitProductNotification } = await import("./notification-runtime");
      await tryEmitProductNotification(event);
      const { tryEmitWorkspaceEvent } = await import("./webhook-delivery");
      await tryEmitWorkspaceEvent({
        correlationId: context.correlationId,
        data: { notificationType: event.type },
        eventType: "billing.processed",
        workspaceId: event.workspaceId,
      });
    },
  });
}

/** Null means this deployment intentionally uses the credential-free local billing adapter. */
export const stripeBillingBff =
  billingAdapter instanceof StripeBillingAdapter && serverConfig.providers.billing.kind === "stripe"
    ? buildBillingBff(serverConfig.providers.billing, billingAdapter)
    : null;

export const lemonSqueezyBillingBff =
  serverConfig.providers.billing.kind === "lemonsqueezy" &&
  billingAdapter instanceof LemonSqueezyBillingAdapter
    ? buildBillingBff(serverConfig.providers.billing, billingAdapter)
    : null;

export const creemBillingBff =
  serverConfig.providers.billing.kind === "creem" && billingAdapter instanceof CreemBillingAdapter
    ? buildBillingBff(serverConfig.providers.billing, billingAdapter)
    : null;

export const polarBillingBff =
  serverConfig.providers.billing.kind === "polar" && billingAdapter instanceof PolarBillingAdapter
    ? buildBillingBff(serverConfig.providers.billing, billingAdapter)
    : null;

export const whopBillingBff =
  serverConfig.providers.billing.kind === "whop" && billingAdapter instanceof WhopBillingAdapter
    ? buildBillingBff(serverConfig.providers.billing, billingAdapter)
    : null;

export const paddleBillingBff =
  serverConfig.providers.billing.kind === "paddle" && billingAdapter instanceof PaddleBillingAdapter
    ? buildBillingBff(serverConfig.providers.billing, billingAdapter)
    : null;

export const dodoBillingBff =
  serverConfig.providers.billing.kind === "dodo" && billingAdapter instanceof DodoBillingAdapter
    ? buildBillingBff(serverConfig.providers.billing, billingAdapter)
    : null;

export const paypalBillingBff =
  serverConfig.providers.billing.kind === "paypal" && billingAdapter instanceof PaypalBillingAdapter
    ? buildBillingBff(serverConfig.providers.billing, billingAdapter)
    : null;

/** The active credentialed billing BFF for browser checkout/portal routes. */
export const activeBillingBff =
  stripeBillingBff ??
  lemonSqueezyBillingBff ??
  creemBillingBff ??
  polarBillingBff ??
  whopBillingBff ??
  paddleBillingBff ??
  dodoBillingBff ??
  paypalBillingBff;
