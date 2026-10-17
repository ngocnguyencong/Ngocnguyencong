import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull();

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
    /** Platform role managed by the Better Auth admin plugin ("user" | "admin"[,...]). */
    role: varchar("role", { length: 32 }).default("user").notNull(),
    banned: boolean("banned").default(false).notNull(),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { mode: "date", withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("idx_user_email").on(table.email)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    token: text("token").notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    /** Set while an admin impersonates this session's user. */
    impersonatedBy: text("impersonated_by").references(() => user.id, { onDelete: "set null" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_session_token").on(table.token),
    index("idx_session_user_id").on(table.userId),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    /** Better Auth issuer: `local:<providerId>` for credential, `local:oauth:<providerId>` or the provider's real issuer for OAuth. */
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: varchar("provider_id", { length: 64 }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_account_issuer_account").on(table.issuer, table.accountId),
    index("idx_account_user_id").on(table.userId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("idx_verification_identifier").on(table.identifier)],
);

export const workspace = pgTable(
  "workspace",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    type: varchar("type", { length: 32 }).default("personal").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("idx_workspace_slug").on(table.slug)],
);

export const workspaceMembership = pgTable(
  "workspace_membership",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).default("owner").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_workspace_membership_workspace_user").on(table.workspaceId, table.userId),
    index("idx_workspace_membership_user_id").on(table.userId),
  ],
);

/** Pending/accepted/revoked membership invites for organization workspaces. */
export const workspaceInvitation = pgTable(
  "workspace_invitation",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 32 }).notNull(),
    token: text("token").notNull(),
    status: varchar("status", { length: 32 }).default("pending").notNull(),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_workspace_invitation_token").on(table.token),
    index("idx_workspace_invitation_workspace_status").on(table.workspaceId, table.status),
    index("idx_workspace_invitation_email").on(table.email),
  ],
);

/**
 * Custom domain attached to a workspace (white-label hostnames). `status`
 * tracks provider-side activation (pending|active|failed|moved|deleted);
 * `verification` stores the DNS records the customer must publish (ownership
 * TXT plus DCV records) so the settings UI can re-render them.
 */
export const workspaceDomain = pgTable(
  "workspace_domain",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    hostname: varchar("hostname", { length: 255 }).notNull(),
    providerHostnameId: text("provider_hostname_id"),
    status: varchar("status", { length: 32 }).default("pending").notNull(),
    sslStatus: varchar("ssl_status", { length: 64 }),
    verification: jsonb("verification").$type<{
      cnameTarget: string;
      ownership?: { name: string; type: string; value: string };
      dcvRecords: {
        cname?: string;
        cnameTarget?: string;
        httpBody?: string;
        httpUrl?: string;
        status?: string;
        txtName?: string;
        txtValue?: string;
      }[];
    }>(),
    lastCheckedAt: timestamp("last_checked_at", { mode: "date", withTimezone: true }),
    verifiedAt: timestamp("verified_at", { mode: "date", withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_workspace_domain_hostname").on(table.hostname),
    index("idx_workspace_domain_workspace").on(table.workspaceId),
    index("idx_workspace_domain_status").on(table.status),
  ],
);

/** Last active workspace for a user; must still resolve against memberships. */
export const userWorkspacePreference = pgTable("user_workspace_preference", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  activeWorkspaceId: text("active_workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Better Auth two-factor secrets/backup codes (never log plaintext). */
export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true).notNull(),
    failedVerificationCount: integer("failed_verification_count").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { mode: "date", withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("idx_two_factor_user_id").on(table.userId),
    index("idx_two_factor_secret").on(table.secret),
  ],
);

/** Better Auth WebAuthn/passkey credentials. */
export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    aaguid: text("aaguid"),
    createdAt: createdAt(),
  },
  (table) => [
    index("idx_passkey_user_id").on(table.userId),
    uniqueIndex("idx_passkey_credential_id").on(table.credentialID),
  ],
);

export const billingCustomer = pgTable(
  "billing_customer",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerCustomerId: varchar("provider_customer_id", { length: 255 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_billing_customer_workspace_provider").on(table.workspaceId, table.provider),
    uniqueIndex("idx_billing_customer_provider_id").on(table.provider, table.providerCustomerId),
  ],
);

export const billingSubscription = pgTable(
  "billing_subscription",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerSubscriptionId: varchar("provider_subscription_id", { length: 255 }).notNull(),
    providerCustomerId: varchar("provider_customer_id", { length: 255 }).notNull(),
    entitlementKey: varchar("entitlement_key", { length: 100 }).notNull(),
    priceReference: varchar("price_reference", { length: 255 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    latestEventOccurredAt: timestamp("latest_event_occurred_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_billing_subscription_provider_id").on(
      table.provider,
      table.providerSubscriptionId,
    ),
    index("idx_billing_subscription_workspace_status").on(table.workspaceId, table.status),
    index("idx_billing_subscription_workspace_entitlement").on(
      table.workspaceId,
      table.entitlementKey,
    ),
  ],
);

/**
 * Opaque, tenant-bound AES-GCM envelope fields for a provider API key.
 * Encryption/decryption stays in @supastack/ai; this table never receives plaintext.
 */
export const providerCredential = pgTable(
  "provider_credential",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 64 }).notNull(),
    algorithm: varchar("algorithm", { length: 32 }).notNull(),
    version: integer("version").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    ciphertext: text("ciphertext").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_provider_credential_workspace_provider").on(table.workspaceId, table.provider),
  ],
);

/** Server-owned AI key mode and optional monthly budget for one workspace. */
export const workspaceAiPolicy = pgTable("workspace_ai_policy", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspace.id, { onDelete: "cascade" }),
  keyMode: varchar("key_mode", { length: 16 }).default("platform").notNull(),
  monthlyBudgetMicrounits: bigint("monthly_budget_microunits", { mode: "bigint" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const entitlement = pgTable(
  "entitlement",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 100 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    source: varchar("source", { length: 32 }).notNull(),
    sourceReference: text("source_reference"),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_entitlement_workspace_key_source").on(
      table.workspaceId,
      table.key,
      table.source,
    ),
    index("idx_entitlement_workspace_status").on(table.workspaceId, table.status),
  ],
);

export const webhookEvent = pgTable(
  "webhook_event",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerEventId: varchar("provider_event_id", { length: 255 }).notNull(),
    verifiedAt: timestamp("verified_at", { mode: "date", withTimezone: true }).notNull(),
    processedAt: timestamp("processed_at", { mode: "date", withTimezone: true }),
    status: varchar("status", { length: 32 }).default("received").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_webhook_provider_event").on(table.provider, table.providerEventId),
    index("idx_webhook_workspace_created").on(table.workspaceId, table.createdAt),
  ],
);

export const aiModel = pgTable(
  "ai_model",
  {
    id: text("id").primaryKey(),
    provider: varchar("provider", { length: 64 }).notNull(),
    model: varchar("model", { length: 255 }).notNull(),
    modelVersion: varchar("model_version", { length: 100 }).notNull(),
    supportsVision: boolean("supports_vision").default(false).notNull(),
    supportsTools: boolean("supports_tools").default(false).notNull(),
    supportsStructuredOutput: boolean("supports_structured_output").default(false).notNull(),
    contextWindow: integer("context_window").notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_ai_model_provider_model_version").on(
      table.provider,
      table.model,
      table.modelVersion,
    ),
  ],
);

export const aiModelPrice = pgTable(
  "ai_model_price",
  {
    id: text("id").primaryKey(),
    modelId: text("model_id")
      .notNull()
      .references(() => aiModel.id, { onDelete: "restrict" }),
    provider: varchar("provider", { length: 64 }).notNull(),
    model: varchar("model", { length: 255 }).notNull(),
    modelVersion: varchar("model_version", { length: 100 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    effectiveFrom: timestamp("effective_from", { mode: "date", withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { mode: "date", withTimezone: true }),
    inputMicrounitsPerMillion: bigint("input_microunits_per_million", { mode: "bigint" }).notNull(),
    outputMicrounitsPerMillion: bigint("output_microunits_per_million", {
      mode: "bigint",
    }).notNull(),
    cachedInputMicrounitsPerMillion: bigint("cached_input_microunits_per_million", {
      mode: "bigint",
    }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("idx_ai_model_price_model_effective").on(table.modelId, table.effectiveFrom)],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    priceId: text("price_id")
      .notNull()
      .references(() => aiModelPrice.id, { onDelete: "restrict" }),
    provider: varchar("provider", { length: 64 }).notNull(),
    model: varchar("model", { length: 255 }).notNull(),
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),
    cachedInputTokens: integer("cached_input_tokens").default(0).notNull(),
    costMicrounits: bigint("cost_microunits", { mode: "bigint" }).notNull(),
    latencyMs: integer("latency_ms").notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    requestId: varchar("request_id", { length: 100 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_ai_usage_request_id").on(table.requestId),
    index("idx_ai_usage_workspace_created").on(table.workspaceId, table.createdAt),
  ],
);

export const taskRun = pgTable(
  "task_run",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    taskName: varchar("task_name", { length: 100 }).notNull(),
    providerRunId: varchar("provider_run_id", { length: 255 }),
    status: varchar("status", { length: 32 }).notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    result: jsonb("result").$type<Record<string, unknown>>(),
    errorCode: varchar("error_code", { length: 100 }),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true }),
    completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("idx_task_run_workspace_created").on(table.workspaceId, table.createdAt)],
);

/** Conservative per-attempt monthly budget holds; settled amounts remain auditable. */
export const aiBudgetReservation = pgTable(
  "ai_budget_reservation",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    taskId: text("task_id")
      .notNull()
      .references(() => taskRun.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { mode: "date", withTimezone: true }).notNull(),
    reservedMicrounits: bigint("reserved_microunits", { mode: "bigint" }).notNull(),
    settledMicrounits: bigint("settled_microunits", { mode: "bigint" }),
    status: varchar("status", { length: 32 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("idx_ai_budget_reservation_workspace_period").on(
      table.workspaceId,
      table.periodStart,
      table.status,
    ),
  ],
);

export const transactionalEmailDelivery = pgTable(
  "transactional_email_delivery",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    template: varchar("template", { length: 100 }).notNull(),
    recipient: varchar("recipient", { length: 255 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    errorCode: varchar("error_code", { length: 100 }),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("idx_transactional_email_workspace_created").on(table.workspaceId, table.createdAt),
  ],
);

/** Metadata for workspace-scoped uploaded objects (avatars/files). Bytes live in ObjectStorage. */
export const storedObject = pgTable(
  "stored_object",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    objectKey: text("object_key").notNull(),
    contentType: varchar("content_type", { length: 128 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    purpose: varchar("purpose", { length: 64 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_stored_object_workspace_key").on(table.workspaceId, table.objectKey),
    index("idx_stored_object_workspace_created").on(table.workspaceId, table.createdAt),
  ],
);

/** In-app notifications scoped to one workspace member. */
export const notification = pgTable(
  "notification",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    href: text("href"),
    readAt: timestamp("read_at", { mode: "date", withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("idx_notification_workspace_user_created").on(
      table.workspaceId,
      table.userId,
      table.createdAt,
    ),
  ],
);

/** Per-member notification delivery preferences inside one workspace. */
export const notificationPreference = pgTable(
  "notification_preference",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    emailInvites: boolean("email_invites").default(true).notNull(),
    emailBilling: boolean("email_billing").default(true).notNull(),
    inAppProduct: boolean("in_app_product").default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.workspaceId] })],
);

/**
 * Append-only accountability trail. `workspaceId` is null only for platform-level
 * events (e.g. admin actions on users); every workspace event stays scoped.
 */
export const auditEvent = pgTable(
  "audit_event",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => workspace.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(),
    targetType: varchar("target_type", { length: 64 }),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: createdAt(),
  },
  (table) => [
    index("idx_audit_event_workspace_created").on(table.workspaceId, table.createdAt),
    index("idx_audit_event_actor_created").on(table.actorUserId, table.createdAt),
    index("idx_audit_event_action_created").on(table.action, table.createdAt),
  ],
);

/** Hashed workspace API credentials; the plaintext key is shown once at creation. */
export const apiKey = pgTable(
  "api_key",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    prefix: varchar("prefix", { length: 24 }).notNull(),
    keyHash: text("key_hash").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
    lastUsedAt: timestamp("last_used_at", { mode: "date", withTimezone: true }),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_api_key_hash").on(table.keyHash),
    index("idx_api_key_workspace_created").on(table.workspaceId, table.createdAt),
  ],
);

/** Outbound webhook subscription owned by a workspace. */
export const webhookEndpoint = pgTable(
  "webhook_endpoint",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    events: jsonb("events").$type<string[]>().notNull(),
    status: varchar("status", { length: 16 }).default("active").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("idx_webhook_endpoint_workspace").on(table.workspaceId, table.status)],
);

/** One delivery attempt ledger row per endpoint per emitted event. */
export const webhookDelivery = pgTable(
  "webhook_delivery",
  {
    id: text("id").primaryKey(),
    endpointId: text("endpoint_id")
      .notNull()
      .references(() => webhookEndpoint.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: varchar("status", { length: 16 }).default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    responseCode: integer("response_code"),
    lastError: text("last_error"),
    deliveredAt: timestamp("delivered_at", { mode: "date", withTimezone: true }),
    nextAttemptAt: timestamp("next_attempt_at", { mode: "date", withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("idx_webhook_delivery_endpoint_created").on(table.endpointId, table.createdAt),
    index("idx_webhook_delivery_workspace_status").on(
      table.workspaceId,
      table.status,
      table.nextAttemptAt,
    ),
  ],
);

/** Workspace-scoped chat conversation owned by one member. */
export const chatThread = pgTable(
  "chat_thread",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("idx_chat_thread_workspace_user_updated").on(
      table.workspaceId,
      table.userId,
      table.updatedAt,
    ),
  ],
);

/** One persisted message inside a chat thread; scope is enforced via the thread. */
export const chatMessage = pgTable(
  "chat_message",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).notNull(),
    content: text("content").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("idx_chat_message_workspace_thread_created").on(
      table.workspaceId,
      table.threadId,
      table.createdAt,
    ),
  ],
);

/** Platform feature flag with an environment-wide default. */
export const featureFlag = pgTable(
  "feature_flag",
  {
    id: text("id").primaryKey(),
    key: varchar("key", { length: 100 }).notNull(),
    description: text("description"),
    enabled: boolean("enabled").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("idx_feature_flag_key").on(table.key)],
);

/**
 * A flag override bound to a workspace or a single user. User overrides win
 * over workspace overrides, which win over the flag's global default.
 */
export const featureFlagOverride = pgTable(
  "feature_flag_override",
  {
    id: text("id").primaryKey(),
    flagId: text("flag_id")
      .notNull()
      .references(() => featureFlag.id, { onDelete: "cascade" }),
    scopeType: varchar("scope_type", { length: 16 }).notNull(),
    scopeId: text("scope_id").notNull(),
    enabled: boolean("enabled").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_feature_flag_override_scope").on(table.flagId, table.scopeType, table.scopeId),
  ],
);

/** Platform announcement banner shown inside the app shell. */
export const announcement = pgTable(
  "announcement",
  {
    id: text("id").primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    severity: varchar("severity", { length: 16 }).default("info").notNull(),
    startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { mode: "date", withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("idx_announcement_window").on(table.startsAt, table.endsAt)],
);

/** Per-user dismissal so banners stay hidden once acknowledged. */
export const announcementDismissal = pgTable(
  "announcement_dismissal",
  {
    id: text("id").primaryKey(),
    announcementId: text("announcement_id")
      .notNull()
      .references(() => announcement.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("idx_announcement_dismissal_user").on(table.announcementId, table.userId),
  ],
);

/**
 * Recurring job schedules ticked by the jobs runtime. `workspace_id` is
 * nullable: NULL marks a platform-level schedule (e.g. rate-limit bucket
 * pruning) owned by `ensurePlatformSchedules`, never by a workspace.
 */
export const jobSchedule = pgTable(
  "job_schedule",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => workspace.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    cron: varchar("cron", { length: 64 }).notNull(),
    input: jsonb("input"),
    enabled: boolean("enabled").default(true).notNull(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    // Cumulative cron occurrences that elapsed unclaimed — a claim stamps
    // its fire time and adds the runs skipped between the stored
    // next_run_at and the claim. Claim-owned: upserts never touch it.
    missedRuns: integer("missed_runs").default(0).notNull(),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("idx_job_schedule_workspace").on(table.workspaceId),
    // One schedule per (workspace, type) — the real conflict target for the
    // no-id upsert path. NULL workspace_id (platform schedules) is excluded:
    // those rows are keyed by deterministic ids like "platform:…".
    uniqueIndex("idx_job_schedule_workspace_type")
      .on(table.workspaceId, table.type)
      .where(sql`"workspace_id" IS NOT NULL`),
    // The hot claim query filters on (enabled, next_run_at <= now) — a
    // partial index over just the enabled rows keeps it tight.
    index("idx_job_schedule_next_run_at")
      .on(table.nextRunAt)
      .where(sql`"enabled"`),
  ],
);

/**
 * Workspace-scoped CMS entry. `type` is product-defined ("post", "page", …) so
 * one table backs blogs, docs, and custom collections; slug is unique per
 * (workspace, type) so different types may reuse a slug.
 */
export const contentEntry = pgTable(
  "content_entry",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    excerpt: text("excerpt"),
    body: text("body").notNull().default(""),
    status: varchar("status", { length: 16 }).default("draft").notNull(),
    /** Optional content locale (BCP-47) so one workspace can mirror entries. */
    locale: varchar("locale", { length: 35 }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }),
    /** Minimum subscription tier required to read the body; NULL = free for every reader. */
    requiredEntitlement: varchar("required_entitlement", { length: 100 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_content_entry_workspace_type_slug").on(
      table.workspaceId,
      table.type,
      table.slug,
    ),
    index("idx_content_entry_workspace_status").on(
      table.workspaceId,
      table.status,
      table.publishedAt,
    ),
  ],
);

/**
 * Workspace feature-board request. Members submit and vote; owner/admin triage
 * `status` (open → under_review → planned → in_progress → shipped | closed).
 * `voteCount` is a denormalized counter updated in the same transaction as
 * vote writes so the board never joins to sort.
 */
export const featureRequest = pgTable(
  "feature_request",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    details: text("details").notNull().default(""),
    status: varchar("status", { length: 16 }).default("open").notNull(),
    voteCount: integer("vote_count").default(0).notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("idx_feature_request_workspace_votes").on(
      table.workspaceId,
      table.voteCount,
      table.createdAt,
    ),
    index("idx_feature_request_workspace_status").on(table.workspaceId, table.status),
  ],
);

/** One vote per member per request; the composite PK is the dedupe. */
export const featureRequestVote = pgTable(
  "feature_request_vote",
  {
    requestId: text("request_id")
      .notNull()
      .references(() => featureRequest.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.requestId, table.userId] }),
    index("idx_feature_request_vote_workspace_user").on(table.workspaceId, table.userId),
  ],
);

/** Sellable catalog item owned by a workspace; orders snapshot price/name at purchase. */
export const commerceProduct = pgTable(
  "commerce_product",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    priceCents: integer("price_cents").notNull(),
    currency: varchar("currency", { length: 3 }).default("usd").notNull(),
    status: varchar("status", { length: 16 }).default("draft").notNull(),
    /** Remaining stock; null means untracked/unlimited. */
    inventory: integer("inventory"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_commerce_product_workspace_slug").on(table.workspaceId, table.slug),
    index("idx_commerce_product_workspace_status").on(table.workspaceId, table.status),
  ],
);

/** One customer order; items live in commerce_order_item. Totals are server-computed. */
export const commerceOrder = pgTable(
  "commerce_order",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    customerEmail: varchar("customer_email", { length: 320 }).notNull(),
    status: varchar("status", { length: 16 }).default("pending").notNull(),
    totalCents: integer("total_cents").notNull(),
    currency: varchar("currency", { length: 3 }).default("usd").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("idx_commerce_order_workspace_created").on(table.workspaceId, table.createdAt),
    index("idx_commerce_order_workspace_status").on(table.workspaceId, table.status),
  ],
);

/**
 * Platform-level waitlist signup for the product's own marketing surface.
 * Deliberately NOT workspace-scoped: entries are pre-auth leads owned by the
 * deployment, like `announcement`/`feature_flag`. `referralCode` powers the
 * shareable `?ref=` loop; `referralCount` is a denormalized counter bumped in
 * the same transaction as referral writes so invite ordering never joins.
 * `status` walks waiting → invited → joined.
 */
export const waitlistEntry = pgTable(
  "waitlist_entry",
  {
    id: text("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    status: varchar("status", { length: 16 }).default("waiting").notNull(),
    referralCode: varchar("referral_code", { length: 32 }).notNull(),
    referredByEntryId: text("referred_by_entry_id").references(
      (): AnyPgColumn => waitlistEntry.id,
      { onDelete: "set null" },
    ),
    referralCount: integer("referral_count").default(0).notNull(),
    invitedAt: timestamp("invited_at", { mode: "date", withTimezone: true }),
    joinedAt: timestamp("joined_at", { mode: "date", withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_waitlist_entry_email").on(table.email),
    uniqueIndex("idx_waitlist_entry_referral_code").on(table.referralCode),
    index("idx_waitlist_entry_status_created").on(table.status, table.createdAt),
    index("idx_waitlist_entry_created_at").on(table.createdAt),
    index("idx_waitlist_entry_referred_by").on(table.referredByEntryId),
  ],
);

/**
 * Early-access invite code issued by a platform admin. `email`-bound codes are
 * reserved for that address; `email: null` codes work for any signup. Codes
 * bound to a waitlist entry mark it `joined` on redemption.
 */
export const earlyAccessCode = pgTable(
  "early_access_code",
  {
    id: text("id").primaryKey(),
    code: varchar("code", { length: 32 }).notNull(),
    email: varchar("email", { length: 255 }),
    waitlistEntryId: text("waitlist_entry_id").references(() => waitlistEntry.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    redeemedByUserId: text("redeemed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    redeemedAt: timestamp("redeemed_at", { mode: "date", withTimezone: true }),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_early_access_code_code").on(table.code),
    index("idx_early_access_code_email").on(table.email),
    index("idx_early_access_code_waitlist_entry").on(table.waitlistEntryId),
  ],
);

/**
 * Append-only referral attribution ledger — the affiliate/referral primitive.
 * `kind` is "waitlist" (a new waitlist entry joined via a code) or "signup"
 * (a new user registered via a code). `referrerEntryId` resolves the code to
 * the owning waitlist entry when one exists.
 */
export const referral = pgTable(
  "referral",
  {
    id: text("id").primaryKey(),
    code: varchar("code", { length: 32 }).notNull(),
    kind: varchar("kind", { length: 16 }).notNull(),
    referrerEntryId: text("referrer_entry_id").references(() => waitlistEntry.id, {
      onDelete: "set null",
    }),
    referredEmail: varchar("referred_email", { length: 255 }),
    referredUserId: text("referred_user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("idx_referral_kind_user").on(table.kind, table.referredUserId),
    uniqueIndex("idx_referral_kind_email").on(table.kind, table.referredEmail),
    index("idx_referral_code_created").on(table.code, table.createdAt),
    index("idx_referral_referrer_entry").on(table.referrerEntryId),
  ],
);

/** Line item inside one order; keeps a name/price snapshot so catalog edits stay safe. */
export const commerceOrderItem = pgTable(
  "commerce_order_item",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => commerceOrder.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => commerceProduct.id, { onDelete: "set null" }),
    productName: varchar("product_name", { length: 200 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("idx_commerce_order_item_order").on(table.orderId),
    index("idx_commerce_order_item_workspace").on(table.workspaceId),
  ],
);

/** Platform-wide spend for anonymous/public AI calls, one row per UTC day (YYYY-MM-DD). */
export const platformAiSpend = pgTable("platform_ai_spend", {
  day: varchar("day", { length: 10 }).primaryKey(),
  spentMicrounits: bigint("spent_microunits", { mode: "bigint" })
    .default(sql`0`)
    .notNull(),
  updatedAt: updatedAt(),
});

/** Shared fixed-window rate-limit buckets; key = `${limiterName}:${callerKey}`. */
export const rateLimitBucket = pgTable(
  "rate_limit_bucket",
  {
    key: text("key").primaryKey(),
    windowStart: timestamp("window_start", { mode: "date", withTimezone: true }).notNull(),
    count: integer("count").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [index("idx_rate_limit_bucket_expires").on(table.expiresAt)],
);

/**
 * A workspace's connected external account (X, Google, Microsoft, SMTP, …).
 * `provider` is a varchar — not an enum — so new providers ship without a
 * migration. Token material lives on the row as an AES-256-GCM envelope
 * written by `connected-account-vault.ts`; every token_* column stays
 * nullable so accounts can exist before tokens are stored (pending) and
 * after they are cleared. Plaintext secrets are never persisted.
 */
export const connectedAccount = pgTable(
  "connected_account",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    externalAccountId: varchar("external_account_id", { length: 255 }).notNull(),
    label: varchar("label", { length: 255 }),
    /** Granted OAuth scopes; null for providers without scopes (e.g. smtp). */
    scopes: text("scopes").array(),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    /** "active" | "needs_reauth" | "revoked" — varchar keeps the set extensible. */
    status: varchar("status", { length: 16 }).default("active").notNull(),
    lastRefreshedAt: timestamp("last_refreshed_at", { mode: "date", withTimezone: true }),
    failureReason: varchar("failure_reason", { length: 500 }),
    tokenAlgorithm: varchar("token_algorithm", { length: 32 }),
    tokenVersion: integer("token_version"),
    tokenIv: text("token_iv"),
    tokenAuthTag: text("token_auth_tag"),
    tokenCiphertext: text("token_ciphertext"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_connected_account_workspace_provider_external").on(
      table.workspaceId,
      table.provider,
      table.externalAccountId,
    ),
    index("idx_connected_account_workspace").on(table.workspaceId),
    index("idx_connected_account_workspace_status").on(table.workspaceId, table.status),
    // Global refresh sweep: status='active' rows with access_token_expires_at
    // IS NOT NULL AND < :before.
    index("idx_connected_account_expiry").on(table.accessTokenExpiresAt),
  ],
);

/**
 * Generic per-workspace usage counter for one period (e.g. a UTC month).
 * The composite primary key IS the counter identity — `consume` upserts on
 * it with a guarded `DO UPDATE ... WHERE used + n <= limit`, so quota
 * enforcement is one atomic statement and concurrent consumers serialize
 * on the row lock. `key` is product-defined ("ai.requests", …) — a varchar,
 * not an enum, so derived products add meters without a migration. Period
 * rollover simply writes a new row; old periods stay for auditing.
 */
export const usageCounter = pgTable(
  "usage_counter",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 100 }).notNull(),
    periodStart: timestamp("period_start", { mode: "date", withTimezone: true }).notNull(),
    used: integer("used").default(0).notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.key, table.periodStart] }),
    index("idx_usage_counter_workspace").on(table.workspaceId),
  ],
);

/**
 * Owner-set hard ceilings per usage meter key, layered on top of the plan
 * `usageLimits` allowance: the effective quota is min(plan limit, cap) and a
 * cap-bound rejection never falls back to prepaid credits. `cap >= 0` is
 * enforced in the database as well as the repository layer.
 */
export const workspaceUsageCap = pgTable(
  "workspace_usage_cap",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 100 }).notNull(),
    cap: integer("cap").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.key] }),
    check("workspace_usage_cap_nonnegative", sql`"cap" >= 0`),
  ],
);

/**
 * Prepaid workspace credit balance — a consumable pool distinct from the
 * per-period `usage_counter` quota (which resets each period; credits do
 * not). `balance` is a cache kept in sync inside the same transaction that
 * appends to `credit_transaction`; the ledger is the source of truth.
 * Positive `amount` rows grant, negative rows spend.
 */
export const creditBalance = pgTable(
  "credit_balance",
  {
    workspaceId: text("workspace_id")
      .primaryKey()
      .references(() => workspace.id, { onDelete: "cascade" }),
    balance: integer("balance").default(0).notNull(),
    updatedAt: updatedAt(),
  },
  // Defense in depth under the guarded UPDATE — the ledger must never go
  // negative even if a future write path bypasses the repository guard.
  () => [check("credit_balance_nonnegative", sql`"balance" >= 0`)],
);

/**
 * Append-only credit ledger. `amount` is signed (grants positive, debits
 * negative); `balanceAfter` snapshots the workspace balance inside the
 * same transaction so history reads stay consistent under concurrency.
 * `kind`: grant | debit | refund | expire | adjustment. `referenceId`
 * links the row to its cause (AI task id, order id, admin action id).
 */
export const creditTransaction = pgTable(
  "credit_transaction",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    kind: varchar("kind", { length: 24 }).notNull(),
    reason: varchar("reason", { length: 255 }),
    referenceId: varchar("reference_id", { length: 128 }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    balanceAfter: integer("balance_after").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("idx_credit_transaction_workspace_created").on(table.workspaceId, table.createdAt),
    index("idx_credit_transaction_reference").on(table.referenceId),
    // Reference-bearing movements are idempotency-keyed: one ledger row per
    // (workspace, kind, reference). Concurrent webhook replays or raced
    // activations hit this constraint instead of double-writing; NULL
    // references (manual admin grants) stay excluded so they can repeat.
    uniqueIndex("uq_credit_transaction_reference")
      .on(table.workspaceId, table.kind, table.referenceId)
      .where(sql`"reference_id" IS NOT NULL`),
  ],
);

/**
 * Push-notification device token registered by a signed-in user's device
 * (Expo push token today). Scoped by `workspaceId` like every user-owned
 * record: a device re-registers under the active workspace, and delivery
 * resolves members → users → tokens. `token` is unique so a reinstall or
 * account switch updates the same row instead of duplicating devices.
 */
export const devicePushToken = pgTable(
  "device_push_token",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull(),
    platform: varchar("platform", { length: 16 }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("idx_device_push_token_token").on(table.token),
    index("idx_device_push_token_user").on(table.userId),
    index("idx_device_push_token_workspace").on(table.workspaceId),
  ],
);

/**
 * Expo push tickets recorded at send time for asynchronous receipt
 * reconciliation — the ticket id is Expo's receipt handle, `token` the
 * device token the message targeted (kept for pruning, never logged).
 * `userId` mirrors the token row's owner for cascade cleanup; it is
 * nullable because fan-out sends can target a workspace's membership.
 * Rows are deleted once a receipt arrives or after 24h regardless.
 */
export const pushTicket = pgTable(
  "push_ticket",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [index("idx_push_ticket_created_at").on(table.createdAt)],
);

/**
 * Cross-device appearance preferences for a signed-in user — the web theme
 * axes (style/color pack/density/radius/font/layout/toast style) stored so a
 * user's picks follow them across browsers, the desktop webview, and the
 * mobile app. `userId` is the PK: one row per account. `preferences` is the
 * JSON snapshot; the web layer validates it against the theme catalogs on
 * every read so removed packs/styles degrade to "no preferences" instead of
 * applying unknown ids.
 */
export const userAppearance = pgTable("user_appearance", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  preferences: jsonb("preferences").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Self-hosted product/marketing analytics event (the `local`
 * ANALYTICS_PROVIDER). Nullable `workspaceId`: anonymous marketing page
 * views are platform-level rows, signed-in app events may carry a
 * workspace. Privacy boundary: no raw IP — `visitorHash` is a daily-
 * rotating salted hash so uniques can be counted without retaining
 * identifiers. `name` is set for kind="event", `path` for kind="pageview".
 */
export const analyticsEvent = pgTable(
  "analytics_event",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => workspace.id, {
      onDelete: "cascade",
    }),
    kind: varchar("kind", { length: 32 }).notNull(),
    name: varchar("name", { length: 120 }),
    path: varchar("path", { length: 512 }),
    referrerHost: varchar("referrer_host", { length: 255 }),
    visitorHash: varchar("visitor_hash", { length: 64 }),
    createdAt: createdAt(),
  },
  (table) => [
    index("idx_analytics_event_created").on(table.createdAt),
    index("idx_analytics_event_workspace_created").on(table.workspaceId, table.createdAt),
    index("idx_analytics_event_kind_created").on(table.kind, table.createdAt),
  ],
);

/* ------------------------------------------------------------------------- */
/* Supadata — website analytics + revenue attribution domain                  */
/* ------------------------------------------------------------------------- */

/** A tracked property. Owned by a workspace; `id` is the public `sdid_*`. */
export const sdSite = pgTable(
  "sd_site",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    domain: varchar("domain", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
    shareId: varchar("share_id", { length: 32 }).notNull(),
    /** Comma-separated extra hostnames allowed to send events. */
    allowedHostnames: text("allowed_hostnames").default("").notNull(),
    cookieless: boolean("cookieless").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_sd_site_share").on(table.shareId),
    index("idx_sd_site_workspace").on(table.workspaceId),
  ],
);

/** Public `sd_*` site key — tracking ingest + analytics read for one site. */
export const sdSiteKey = pgTable(
  "sd_site_key",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sdSite.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }),
    prefix: varchar("prefix", { length: 16 }).notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    lastUsedAt: timestamp("last_used_at", { mode: "date", withTimezone: true }),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("idx_sd_site_key_hash").on(table.keyHash),
    index("idx_sd_site_key_site").on(table.siteId),
  ],
);

/** One person visiting a site; identified by the tracker cookie value. */
export const sdVisitor = pgTable(
  "sd_visitor",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sdSite.id, { onDelete: "cascade" }),
    visitorKey: varchar("visitor_key", { length: 64 }).notNull(),
    userId: varchar("user_id", { length: 128 }),
    email: varchar("email", { length: 255 }),
    name: varchar("name", { length: 255 }),
    image: text("image"),
    firstSeenAt: timestamp("first_seen_at", { mode: "date", withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { mode: "date", withTimezone: true }).notNull(),
    sessionCount: integer("session_count").default(1).notNull(),
    pageviewCount: integer("pageview_count").default(0).notNull(),
    // first-touch attribution
    firstReferrer: text("first_referrer"),
    firstUtmSource: varchar("first_utm_source", { length: 255 }),
    firstUtmMedium: varchar("first_utm_medium", { length: 255 }),
    firstUtmCampaign: varchar("first_utm_campaign", { length: 255 }),
    firstUtmTerm: varchar("first_utm_term", { length: 255 }),
    firstUtmContent: varchar("first_utm_content", { length: 255 }),
    firstClickId: varchar("first_click_id", { length: 255 }),
    entryPage: varchar("entry_page", { length: 512 }),
    // last-touch attribution
    lastReferrer: text("last_referrer"),
    lastUtmSource: varchar("last_utm_source", { length: 255 }),
    lastUtmMedium: varchar("last_utm_medium", { length: 255 }),
    lastUtmCampaign: varchar("last_utm_campaign", { length: 255 }),
    lastClickId: varchar("last_click_id", { length: 255 }),
    // geo/device snapshot
    country: varchar("country", { length: 8 }),
    region: varchar("region", { length: 120 }),
    city: varchar("city", { length: 120 }),
    device: varchar("device", { length: 16 }),
    browser: varchar("browser", { length: 80 }),
    os: varchar("os", { length: 80 }),
    language: varchar("language", { length: 40 }),
    timezone: varchar("timezone", { length: 80 }),
    isCustomer: boolean("is_customer").default(false).notNull(),
    revenueCents: integer("revenue_cents").default(0).notNull(),
    predictionScore: doublePrecision("prediction_score").default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("idx_sd_visitor_key").on(table.siteId, table.visitorKey),
    index("idx_sd_visitor_last_seen").on(table.siteId, table.lastSeenAt),
    index("idx_sd_visitor_email").on(table.siteId, table.email),
    index("idx_sd_visitor_user_id").on(table.siteId, table.userId),
  ],
);

export const sdSession = pgTable(
  "sd_session",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sdSite.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id")
      .notNull()
      .references(() => sdVisitor.id, { onDelete: "cascade" }),
    sessionKey: varchar("session_key", { length: 96 }).notNull(),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true }).notNull(),
    lastActivityAt: timestamp("last_activity_at", { mode: "date", withTimezone: true }).notNull(),
    entryPage: varchar("entry_page", { length: 512 }),
    referrer: text("referrer"),
    utmSource: varchar("utm_source", { length: 255 }),
    utmMedium: varchar("utm_medium", { length: 255 }),
    utmCampaign: varchar("utm_campaign", { length: 255 }),
    utmTerm: varchar("utm_term", { length: 255 }),
    utmContent: varchar("utm_content", { length: 255 }),
    clickId: varchar("click_id", { length: 255 }),
    channel: varchar("channel", { length: 32 }),
    source: varchar("source", { length: 255 }),
    medium: varchar("medium", { length: 255 }),
    campaign: varchar("campaign", { length: 255 }),
    country: varchar("country", { length: 8 }),
    region: varchar("region", { length: 120 }),
    city: varchar("city", { length: 120 }),
    device: varchar("device", { length: 16 }),
    browser: varchar("browser", { length: 80 }),
    os: varchar("os", { length: 80 }),
    pageviews: integer("pageviews").default(0).notNull(),
    isBounce: boolean("is_bounce").default(true).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("idx_sd_session_key").on(table.siteId, table.sessionKey),
    index("idx_sd_session_started").on(table.siteId, table.startedAt),
    index("idx_sd_session_visitor").on(table.visitorId, table.startedAt),
  ],
);

export const sdEvent = pgTable(
  "sd_event",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sdSite.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id")
      .notNull()
      .references(() => sdVisitor.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => sdSession.id, { onDelete: "set null" }),
    /** pageview | custom | goal | identify | payment_signal | external_link */
    type: varchar("type", { length: 24 }).notNull(),
    name: varchar("name", { length: 255 }),
    path: varchar("path", { length: 1024 }),
    hostname: varchar("hostname", { length: 255 }),
    referrer: text("referrer"),
    utmSource: varchar("utm_source", { length: 255 }),
    utmMedium: varchar("utm_medium", { length: 255 }),
    utmCampaign: varchar("utm_campaign", { length: 255 }),
    utmTerm: varchar("utm_term", { length: 255 }),
    utmContent: varchar("utm_content", { length: 255 }),
    /** JSON map of ad click ids (gclid, fbclid, …). */
    clickIds: text("click_ids"),
    /** JSON custom event props. */
    props: text("props"),
    channel: varchar("channel", { length: 32 }),
    source: varchar("source", { length: 255 }),
    medium: varchar("medium", { length: 255 }),
    campaign: varchar("campaign", { length: 255 }),
    country: varchar("country", { length: 8 }),
    region: varchar("region", { length: 120 }),
    city: varchar("city", { length: 120 }),
    device: varchar("device", { length: 16 }),
    browser: varchar("browser", { length: 80 }),
    os: varchar("os", { length: 80 }),
    createdAt: createdAt(),
  },
  (table) => [
    index("idx_sd_event_created").on(table.siteId, table.createdAt),
    index("idx_sd_event_type_created").on(table.siteId, table.type, table.createdAt),
    index("idx_sd_event_name_created").on(table.siteId, table.name, table.createdAt),
    index("idx_sd_event_path_created").on(table.siteId, table.path, table.createdAt),
    index("idx_sd_event_visitor").on(table.visitorId, table.createdAt),
  ],
);

export const sdPayment = pgTable(
  "sd_payment",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sdSite.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").references(() => sdVisitor.id, { onDelete: "set null" }),
    email: varchar("email", { length: 255 }),
    provider: varchar("provider", { length: 32 }).notNull(),
    externalId: varchar("external_id", { length: 255 }),
    kind: varchar("kind", { length: 24 }).default("payment").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: varchar("currency", { length: 8 }).default("usd").notNull(),
    interval: varchar("interval", { length: 16 }).default("once").notNull(),
    mrrCents: integer("mrr_cents").default(0).notNull(),
    productName: varchar("product_name", { length: 255 }),
    status: varchar("status", { length: 24 }).default("active").notNull(),
    channel: varchar("channel", { length: 32 }),
    source: varchar("source", { length: 255 }),
    medium: varchar("medium", { length: 255 }),
    campaign: varchar("campaign", { length: 255 }),
    referrer: text("referrer"),
    occurredAt: timestamp("occurred_at", { mode: "date", withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("idx_sd_payment_external").on(table.siteId, table.externalId),
    index("idx_sd_payment_occurred").on(table.siteId, table.occurredAt),
    index("idx_sd_payment_visitor").on(table.visitorId, table.occurredAt),
  ],
);

export const sdGoal = pgTable(
  "sd_goal",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sdSite.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    type: varchar("type", { length: 16 }).notNull(),
    value: varchar("value", { length: 512 }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("idx_sd_goal_site").on(table.siteId)],
);

export const sdFunnel = pgTable(
  "sd_funnel",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sdSite.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    steps: text("steps").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("idx_sd_funnel_site").on(table.siteId)],
);

export const sdAlert = pgTable(
  "sd_alert",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sdSite.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    metric: varchar("metric", { length: 32 }).notNull(),
    condition: varchar("condition", { length: 8 }).notNull(),
    threshold: integer("threshold").notNull(),
    period: varchar("period", { length: 8 }).default("day").notNull(),
    target: varchar("target", { length: 255 }),
    active: boolean("active").default(true).notNull(),
    lastFiredAt: timestamp("last_fired_at", { mode: "date", withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index("idx_sd_alert_site").on(table.siteId, table.active)],
);

export const sdAlertEvent = pgTable(
  "sd_alert_event",
  {
    id: text("id").primaryKey(),
    alertId: text("alert_id")
      .notNull()
      .references(() => sdAlert.id, { onDelete: "cascade" }),
    value: doublePrecision("value").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("idx_sd_alert_event_alert").on(table.alertId, table.createdAt)],
);

export const sdIntegration = pgTable(
  "sd_integration",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sdSite.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    status: varchar("status", { length: 24 }).default("connected").notNull(),
    meta: text("meta"),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("idx_sd_integration_site_provider").on(table.siteId, table.provider)],
);

export const sdMention = pgTable(
  "sd_mention",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sdSite.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 32 }).notNull(),
    author: varchar("author", { length: 120 }),
    text: text("text").notNull(),
    url: varchar("url", { length: 1024 }),
    occurredAt: timestamp("occurred_at", { mode: "date", withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("idx_sd_mention_site").on(table.siteId, table.occurredAt)],
);

export const sdKeyword = pgTable(
  "sd_keyword",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sdSite.id, { onDelete: "cascade" }),
    query: varchar("query", { length: 255 }).notNull(),
    clicks: integer("clicks").default(0).notNull(),
    impressions: integer("impressions").default(0).notNull(),
    position: doublePrecision("position").default(0).notNull(),
    date: timestamp("date", { mode: "date", withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("idx_sd_keyword_site_date").on(table.siteId, table.date)],
);
