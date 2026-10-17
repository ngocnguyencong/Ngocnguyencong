import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  account,
  aiModelPrice,
  aiUsage,
  billingCustomer,
  billingSubscription,
  earlyAccessCode,
  entitlement,
  featureRequest,
  featureRequestVote,
  notification,
  notificationPreference,
  passkey,
  referral,
  storedObject,
  taskRun,
  transactionalEmailDelivery,
  twoFactor,
  user,
  userWorkspacePreference,
  waitlistEntry,
  webhookEvent,
  workspace,
  workspaceAiPolicy,
  workspaceInvitation,
  workspaceMembership,
} from "./schema.js";
import * as databaseSchema from "./schema.js";

describe("database schema", () => {
  it("defines the workspace-scoped Core V1 tables", () => {
    expect(
      [
        workspace,
        workspaceMembership,
        workspaceInvitation,
        userWorkspacePreference,
        billingCustomer,
        billingSubscription,
        entitlement,
        webhookEvent,
        aiModelPrice,
        aiUsage,
        taskRun,
        transactionalEmailDelivery,
        (databaseSchema as Record<string, unknown>).providerCredential,
        workspaceAiPolicy,
        twoFactor,
        passkey,
        storedObject,
        notification,
        notificationPreference,
      ].map(getTableName),
    ).toEqual([
      "workspace",
      "workspace_membership",
      "workspace_invitation",
      "user_workspace_preference",
      "billing_customer",
      "billing_subscription",
      "entitlement",
      "webhook_event",
      "ai_model_price",
      "ai_usage",
      "task_run",
      "transactional_email_delivery",
      "provider_credential",
      "workspace_ai_policy",
      "two_factor",
      "passkey",
      "stored_object",
      "notification",
      "notification_preference",
    ]);
  });

  it("stores provider credentials as workspace/provider-scoped encrypted envelopes", () => {
    const credential = (databaseSchema as Record<string, unknown>).providerCredential;

    expect(credential).toBeDefined();
    if (credential === undefined) {
      return;
    }

    const columns = getTableColumns(credential as never) as Record<
      string,
      { getSQLType?: () => string; notNull?: boolean }
    >;
    expect(columns.workspaceId?.notNull).toBe(true);
    expect(columns.provider?.notNull).toBe(true);
    expect(columns.algorithm?.notNull).toBe(true);
    expect(columns.version?.getSQLType?.()).toBe("integer");
    expect(columns.ciphertext?.notNull).toBe(true);
    expect(columns).not.toHaveProperty("apiKey");
    expect(columns).not.toHaveProperty("plaintext");
  });

  it("keeps provider billing identities owned by a workspace", () => {
    const customerColumns = getTableColumns(billingCustomer);
    const subscriptionColumns = getTableColumns(billingSubscription);

    expect(customerColumns.workspaceId.notNull).toBe(true);
    expect(customerColumns.providerCustomerId.notNull).toBe(true);
    expect(subscriptionColumns.workspaceId.notNull).toBe(true);
    expect(subscriptionColumns.providerSubscriptionId.notNull).toBe(true);
    expect(subscriptionColumns.entitlementKey.notNull).toBe(true);
    expect(subscriptionColumns.latestEventOccurredAt.notNull).toBe(true);
  });

  it("stores every model price and recorded cost as bigint microunits", () => {
    const priceColumns = getTableColumns(aiModelPrice);
    const usageColumns = getTableColumns(aiUsage);

    expect(priceColumns.inputMicrounitsPerMillion.getSQLType()).toBe("bigint");
    expect(priceColumns.outputMicrounitsPerMillion.getSQLType()).toBe("bigint");
    expect(priceColumns.cachedInputMicrounitsPerMillion.getSQLType()).toBe("bigint");
    expect(usageColumns.costMicrounits.getSQLType()).toBe("bigint");
    expect(getTableColumns(workspaceAiPolicy).monthlyBudgetMicrounits.getSQLType()).toBe("bigint");
  });

  it("keeps bigint defaults migration-serializable", () => {
    const priceColumns = getTableColumns(aiModelPrice);

    expect(priceColumns.cachedInputMicrounitsPerMillion.default).toBeUndefined();
  });

  it("defines organization invite and active-workspace preference tables", () => {
    expect(getTableName(workspaceInvitation)).toBe("workspace_invitation");
    expect(getTableName(userWorkspacePreference)).toBe("user_workspace_preference");
    expect(getTableColumns(workspaceInvitation).workspaceId.notNull).toBe(true);
    expect(getTableColumns(workspaceInvitation).token.notNull).toBe(true);
    expect(getTableColumns(userWorkspacePreference).activeWorkspaceId.notNull).toBe(true);
  });

  it("satisfies Better Auth's issuer-keyed account contract", () => {
    const columns = getTableColumns(account);

    expect(columns.issuer.getSQLType()).toBe("text");
    expect(columns.issuer.notNull).toBe(true);

    const accountKey = getTableConfig(account).indexes.find((index) => index.config.unique);
    expect(accountKey).toBeDefined();
    expect(
      accountKey!.config.columns.map((column) =>
        typeof column === "object" && "name" in column ? column.name : String(column),
      ),
    ).toEqual(["issuer", "account_id"]);
  });

  it("defines the workspace feature-board tables", () => {
    expect(getTableName(featureRequest)).toBe("feature_request");
    expect(getTableName(featureRequestVote)).toBe("feature_request_vote");

    const requestColumns = getTableColumns(featureRequest);
    expect(requestColumns.workspaceId.notNull).toBe(true);
    expect(requestColumns.title.notNull).toBe(true);
    expect(requestColumns.status.default).toBe("open");
    expect(requestColumns.voteCount.default).toBe(0);

    const voteColumns = getTableColumns(featureRequestVote);
    expect(voteColumns.requestId.notNull).toBe(true);
    expect(voteColumns.workspaceId.notNull).toBe(true);
    expect(voteColumns.userId.notNull).toBe(true);

    const votePrimaryKey = getTableConfig(featureRequestVote).primaryKeys[0];
    expect(votePrimaryKey).toBeDefined();
    expect(votePrimaryKey!.columns.map((column) => (column as { name: string }).name)).toEqual([
      "request_id",
      "user_id",
    ]);
  });

  it("defines platform-level growth tables (waitlist, early-access codes, referrals)", () => {
    expect(getTableName(waitlistEntry)).toBe("waitlist_entry");
    expect(getTableName(earlyAccessCode)).toBe("early_access_code");
    expect(getTableName(referral)).toBe("referral");

    // Waitlist entries are platform-level marketing records, not
    // workspace-owned — no workspaceId column on any of the three tables.
    const entryColumns = getTableColumns(waitlistEntry);
    expect(entryColumns.email.notNull).toBe(true);
    expect(entryColumns.status.default).toBe("waiting");
    expect(entryColumns.referralCode.notNull).toBe(true);
    expect(entryColumns.referralCount.default).toBe(0);
    expect(entryColumns).not.toHaveProperty("workspaceId");

    const codeColumns = getTableColumns(earlyAccessCode);
    expect(codeColumns.code.notNull).toBe(true);
    expect(codeColumns).not.toHaveProperty("workspaceId");

    const referralColumns = getTableColumns(referral);
    expect(referralColumns.code.notNull).toBe(true);
    expect(referralColumns.kind.notNull).toBe(true);
    expect(referralColumns).not.toHaveProperty("workspaceId");

    const entryIndexes = getTableConfig(waitlistEntry).indexes;
    expect(entryIndexes.map((index) => index.config.name)).toContain(
      "idx_waitlist_entry_created_at",
    );
    const entryUnique = entryIndexes
      .filter((index) => index.config.unique)
      .map((index) =>
        index.config.columns.map((column) =>
          typeof column === "object" && "name" in column ? column.name : String(column),
        ),
      );
    expect(entryUnique).toContainEqual(["email"]);
    expect(entryUnique).toContainEqual(["referral_code"]);

    const codeUnique = getTableConfig(earlyAccessCode)
      .indexes.filter((index) => index.config.unique)
      .map((index) =>
        index.config.columns.map((column) =>
          typeof column === "object" && "name" in column ? column.name : String(column),
        ),
      );
    expect(codeUnique).toContainEqual(["code"]);
  });

  it("defines Better Auth two-factor and passkey tables", () => {
    expect(getTableName(twoFactor)).toBe("two_factor");
    expect(getTableName(passkey)).toBe("passkey");
    expect(getTableColumns(user).twoFactorEnabled.notNull).toBe(true);
    expect(getTableColumns(twoFactor).secret.notNull).toBe(true);
    expect(getTableColumns(passkey).credentialID.notNull).toBe(true);
  });

  it("defines the workspace credit ledger tables", () => {
    const balance = (databaseSchema as Record<string, unknown>).creditBalance;
    const transaction = (databaseSchema as Record<string, unknown>).creditTransaction;
    expect(balance).toBeDefined();
    expect(transaction).toBeDefined();
    expect(getTableName(balance as never)).toBe("credit_balance");
    expect(getTableName(transaction as never)).toBe("credit_transaction");

    const balanceColumns = getTableColumns(balance as never);
    expect(balanceColumns.workspaceId.notNull).toBe(true);
    expect(balanceColumns.balance.getSQLType()).toBe("integer");

    const transactionColumns = getTableColumns(transaction as never);
    expect(transactionColumns.workspaceId.notNull).toBe(true);
    expect(transactionColumns.amount.notNull).toBe(true);
    expect(transactionColumns.kind.notNull).toBe(true);
    expect(transactionColumns.balanceAfter.notNull).toBe(true);
  });

  it("defines the device push token table scoped by workspace and user", () => {
    const table = (databaseSchema as Record<string, unknown>).devicePushToken;
    expect(table).toBeDefined();
    expect(getTableName(table as never)).toBe("device_push_token");

    const columns = getTableColumns(table as never);
    expect(columns.userId.notNull).toBe(true);
    expect(columns.workspaceId.notNull).toBe(true);
    expect(columns.token.notNull).toBe(true);
    expect(columns.platform.notNull).toBe(true);

    const unique = getTableConfig(table as never)
      .indexes.filter((index) => index.config.unique)
      .map((index) =>
        index.config.columns.map((column) =>
          typeof column === "object" && "name" in column ? column.name : String(column),
        ),
      );
    expect(unique).toContainEqual(["token"]);
  });

  it("defines the self-hosted analytics event table", () => {
    const table = (databaseSchema as Record<string, unknown>).analyticsEvent;
    expect(table).toBeDefined();
    expect(getTableName(table as never)).toBe("analytics_event");

    const columns = getTableColumns(table as never);
    expect(columns.kind.notNull).toBe(true);
    expect(columns).not.toHaveProperty("ip");
    expect(columns).not.toHaveProperty("ipAddress");
  });
});
