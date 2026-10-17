export type TransactionalEmail = Readonly<{
  workspaceId: string;
  to: string;
  subject: string;
  text: string;
  /** Optional branded HTML companion; text stays the required fallback. */
  html?: string;
  /** BCP-47 tag for the rendered HTML shell (`lang` attribute). */
  lang?: string;
  /** Localized footer line for the rendered HTML shell. */
  footer?: string;
  category: "transactional";
}>;

export type EmailMessage =
  | TransactionalEmail
  | Readonly<{
      workspaceId: string;
      to: string;
      subject: string;
      text: string;
      category: "outreach";
    }>;

export type EmailDelivery = Readonly<{
  id: string;
  workspaceId: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  status: "queued";
}>;

export type EmailDeliveryStatus = Readonly<{
  id: string;
  workspaceId: string;
  status: "queued";
}>;

export type DeliveryStatusQuery = Readonly<{
  workspaceId: string;
  deliveryId: string;
}>;

export interface EmailSender {
  send(input: TransactionalEmail): Promise<EmailDelivery>;
  getStatus(input: DeliveryStatusQuery): Promise<EmailDeliveryStatus | undefined>;
}

export interface EmailDeliveryStatusStoreOptions {
  maxEntries?: number;
  now?: () => number;
  ttlMs?: number;
}

type StoredEmailDeliveryStatus = EmailDeliveryStatus & Readonly<{ expiresAt: number }>;

const DEFAULT_STATUS_MAX_ENTRIES = 1_000;
const DEFAULT_STATUS_TTL_MS = 60 * 60 * 1_000;
const MAX_STATUS_ID_LENGTH = 256;
const MAX_STATUS_WORKSPACE_ID_LENGTH = 128;

/** Bounded store for non-sensitive delivery state; message content is discarded. */
export class EmailDeliveryStatusStore {
  private readonly deliveries = new Map<string, StoredEmailDeliveryStatus>();
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly ttlMs: number;

  constructor(options: EmailDeliveryStatusStoreOptions = {}) {
    this.maxEntries = normalizePositiveInteger(options.maxEntries, DEFAULT_STATUS_MAX_ENTRIES);
    this.ttlMs = normalizePositiveInteger(options.ttlMs, DEFAULT_STATUS_TTL_MS);
    this.now = options.now ?? Date.now;
  }

  record(delivery: EmailDelivery): void {
    if (
      delivery.id.length === 0 ||
      delivery.id.length > MAX_STATUS_ID_LENGTH ||
      delivery.workspaceId.length === 0 ||
      delivery.workspaceId.length > MAX_STATUS_WORKSPACE_ID_LENGTH
    ) {
      return;
    }
    const now = this.now();
    this.pruneExpired(now);
    this.deliveries.delete(delivery.id);
    this.deliveries.set(delivery.id, {
      expiresAt: now + this.ttlMs,
      id: delivery.id,
      status: delivery.status,
      workspaceId: delivery.workspaceId,
    });
    while (this.deliveries.size > this.maxEntries) {
      const oldest = this.deliveries.keys().next().value;
      if (oldest === undefined) break;
      this.deliveries.delete(oldest);
    }
  }

  get(query: DeliveryStatusQuery): EmailDeliveryStatus | undefined {
    const delivery = this.deliveries.get(query.deliveryId);
    if (delivery === undefined || delivery.workspaceId !== query.workspaceId) {
      return undefined;
    }
    if (delivery.expiresAt <= this.now()) {
      this.deliveries.delete(query.deliveryId);
      return undefined;
    }
    // Keep recently queried status available within the fixed TTL window.
    this.deliveries.delete(query.deliveryId);
    this.deliveries.set(query.deliveryId, delivery);
    return { id: delivery.id, status: delivery.status, workspaceId: delivery.workspaceId };
  }

  private pruneExpired(now: number): void {
    for (const [id, delivery] of this.deliveries) {
      if (delivery.expiresAt <= now) {
        this.deliveries.delete(id);
      }
    }
  }
}

export class OutreachEmailRejectedError extends Error {
  constructor() {
    super("Outreach email is not supported by the transactional email sender.");
    this.name = "OutreachEmailRejectedError";
  }
}

export class TransactionalEmailDeliveryError extends Error {
  constructor(provider: string) {
    super(`${provider} did not return a transactional delivery ID.`);
    this.name = "TransactionalEmailDeliveryError";
  }
}

type ProviderTransactionalEmailSender = EmailSender & {
  send(input: EmailMessage): Promise<EmailDelivery>;
};

abstract class TransactionalProviderEmailSender implements ProviderTransactionalEmailSender {
  private readonly deliveries = new EmailDeliveryStatusStore();

  abstract send(input: EmailMessage): Promise<EmailDelivery>;

  async getStatus(input: DeliveryStatusQuery): Promise<EmailDeliveryStatus | undefined> {
    return this.deliveries.get(input);
  }

  protected requireTransactional(input: EmailMessage): asserts input is TransactionalEmail {
    if (input.category !== "transactional") {
      throw new OutreachEmailRejectedError();
    }
  }

  protected recordDelivery(input: TransactionalEmail, deliveryId: string): EmailDelivery {
    const delivery: EmailDelivery = {
      id: deliveryId,
      workspaceId: input.workspaceId,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html === undefined ? {} : { html: input.html }),
      status: "queued",
    };

    this.deliveries.record(delivery);
    return delivery;
  }
}

export type ResendSendEmailInput = Readonly<{
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
}>;

export type ResendSendEmailResult = Readonly<{
  data: Readonly<{ id: string }> | null;
  error: unknown;
}>;

/** The minimal server-side Resend SDK surface required by this adapter. */
export interface ResendTransactionalClient {
  emails: {
    send(input: ResendSendEmailInput): Promise<ResendSendEmailResult>;
  };
}

/**
 * Server-side Resend adapter for one transactional delivery at a time. It has
 * no campaign or outreach capability and accepts no provider credentials.
 */
export class ResendTransactionalEmailSender extends TransactionalProviderEmailSender {
  constructor(
    private readonly client: ResendTransactionalClient,
    private readonly from: string,
  ) {
    super();
  }

  async send(input: EmailMessage): Promise<EmailDelivery> {
    this.requireTransactional(input);
    const result = await this.client.emails.send({
      from: this.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      ...(input.html === undefined ? {} : { html: input.html }),
    });

    if (result.error !== null || result.data === null) {
      throw new TransactionalEmailDeliveryError("Resend");
    }

    return this.recordDelivery(input, result.data.id);
  }
}

export type SesSendEmailCommandInput = Readonly<{
  FromEmailAddress: string;
  Destination: Readonly<{ ToAddresses: string[] }>;
  Content: Readonly<{
    Simple: Readonly<{
      Subject: Readonly<{ Data: string; Charset: "UTF-8" }>;
      Body: Readonly<{
        Text: Readonly<{ Data: string; Charset: "UTF-8" }>;
        Html?: Readonly<{ Data: string; Charset: "UTF-8" }>;
      }>;
    }>;
  }>;
}>;

/**
 * The factory keeps `SendEmailCommand` construction at the app composition
 * boundary, allowing the package to remain independent of AWS SDK imports.
 */
export interface SesTransactionalClient {
  createSendEmailCommand(input: SesSendEmailCommandInput): unknown;
  send(command: unknown): Promise<Readonly<{ MessageId?: string }>>;
}

/** Server-side SES v3 adapter for individual transactional messages. */
export class SesTransactionalEmailSender extends TransactionalProviderEmailSender {
  constructor(
    private readonly client: SesTransactionalClient,
    private readonly from: string,
  ) {
    super();
  }

  async send(input: EmailMessage): Promise<EmailDelivery> {
    this.requireTransactional(input);
    const command = this.client.createSendEmailCommand({
      FromEmailAddress: this.from,
      Destination: { ToAddresses: [input.to] },
      Content: {
        Simple: {
          Subject: { Data: input.subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: input.text, Charset: "UTF-8" },
            ...(input.html === undefined
              ? {}
              : { Html: { Data: input.html, Charset: "UTF-8" as const } }),
          },
        },
      },
    });
    const result = await this.client.send(command);

    if (result.MessageId === undefined) {
      throw new TransactionalEmailDeliveryError("SES");
    }

    return this.recordDelivery(input, result.MessageId);
  }
}

/** A deterministic, provider-free local outbox for transactional mail. */
export type LocalOutboxEmailSenderOptions = EmailDeliveryStatusStoreOptions;

type LocalOutboxEntry = Readonly<{ delivery: EmailDelivery; expiresAt: number }>;

const DEFAULT_LOCAL_OUTBOX_MAX_ENTRIES = 100;
const DEFAULT_LOCAL_OUTBOX_TTL_MS = 15 * 60 * 1_000;
const LOCAL_OUTBOX_FIELD_LIMITS = Object.freeze({
  html: 8_192,
  subject: 512,
  text: 8_192,
  to: 320,
  workspaceId: 128,
});

export class LocalOutboxEmailSender implements EmailSender {
  private nextDeliveryId = 1;
  private readonly deliveries = new Map<string, LocalOutboxEntry>();
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly ttlMs: number;

  constructor(options: LocalOutboxEmailSenderOptions = {}) {
    this.maxEntries = normalizePositiveInteger(
      options.maxEntries,
      DEFAULT_LOCAL_OUTBOX_MAX_ENTRIES,
    );
    this.ttlMs = normalizePositiveInteger(options.ttlMs, DEFAULT_LOCAL_OUTBOX_TTL_MS);
    this.now = options.now ?? Date.now;
  }

  async send(input: EmailMessage): Promise<EmailDelivery> {
    if (input.category !== "transactional") {
      throw new OutreachEmailRejectedError();
    }

    const delivery: EmailDelivery = {
      id: `email_${this.nextDeliveryId++}`,
      workspaceId: input.workspaceId,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html === undefined ? {} : { html: input.html }),
      status: "queued",
    };

    const now = this.now();
    this.pruneExpired(now);
    this.deliveries.set(delivery.id, {
      delivery: truncateLocalDelivery(delivery),
      expiresAt: now + this.ttlMs,
    });
    while (this.deliveries.size > this.maxEntries) {
      const oldest = this.deliveries.keys().next().value;
      if (oldest === undefined) break;
      this.deliveries.delete(oldest);
    }
    return delivery;
  }

  async getStatus(input: DeliveryStatusQuery): Promise<EmailDelivery | undefined> {
    const entry = this.deliveries.get(input.deliveryId);
    if (entry === undefined || entry.delivery.workspaceId !== input.workspaceId) {
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.deliveries.delete(input.deliveryId);
      return undefined;
    }
    return entry.delivery;
  }

  /** Newest-first snapshot for local mail-preview DX. */
  listDeliveries(workspaceId?: string): readonly EmailDelivery[] {
    this.pruneExpired(this.now());
    const values = [...this.deliveries.values()]
      .map((entry) => entry.delivery)
      .filter((delivery) => (workspaceId ? delivery.workspaceId === workspaceId : true));
    return values.reverse();
  }

  private pruneExpired(now: number): void {
    for (const [id, entry] of this.deliveries) {
      if (entry.expiresAt <= now) {
        this.deliveries.delete(id);
      }
    }
  }
}

function truncateLocalDelivery(delivery: EmailDelivery): EmailDelivery {
  return {
    ...delivery,
    ...(delivery.html === undefined
      ? {}
      : { html: delivery.html.slice(0, LOCAL_OUTBOX_FIELD_LIMITS.html) }),
    subject: delivery.subject.slice(0, LOCAL_OUTBOX_FIELD_LIMITS.subject),
    text: delivery.text.slice(0, LOCAL_OUTBOX_FIELD_LIMITS.text),
    to: delivery.to.slice(0, LOCAL_OUTBOX_FIELD_LIMITS.to),
    workspaceId: delivery.workspaceId.slice(0, LOCAL_OUTBOX_FIELD_LIMITS.workspaceId),
  };
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("A positive integer retention limit is required.");
  }
  return value;
}

const LOCAL_OUTBOX_KEY = Symbol.for("@supastack/email/local-outbox");
const localOutboxRuntime = globalThis as typeof globalThis & {
  [LOCAL_OUTBOX_KEY]?: LocalOutboxEmailSender;
};

/** Process-wide local outbox so auth OTP, invites, and /mail-preview share one buffer. */
export function getSharedLocalOutboxEmailSender(): LocalOutboxEmailSender {
  localOutboxRuntime[LOCAL_OUTBOX_KEY] ??= new LocalOutboxEmailSender();
  return localOutboxRuntime[LOCAL_OUTBOX_KEY];
}

export {
  EmailSdkTransactionalEmailSender,
  type EmailSdkMessage,
  type EmailSdkProviderName,
  type EmailSdkSendClient,
  type EmailSdkSendResult,
} from "./email-sdk";

import { renderTransactionalEmailHtml } from "./templates";

/**
 * Decorates a transactional sender: when a message has no `html`, render the
 * branded template from subject+text so every provider sends multipart mail.
 */
export class HtmlTemplatedEmailSender implements EmailSender {
  constructor(private readonly inner: EmailSender) {}

  async send(input: TransactionalEmail): Promise<EmailDelivery> {
    return this.inner.send(
      input.html === undefined
        ? {
            ...input,
            html: await renderTransactionalEmailHtml({
              body: input.text,
              ...(input.footer === undefined ? {} : { footer: input.footer }),
              ...(input.lang === undefined ? {} : { lang: input.lang }),
              subject: input.subject,
            }),
          }
        : input,
    );
  }

  async getStatus(input: DeliveryStatusQuery): Promise<EmailDeliveryStatus | undefined> {
    return this.inner.getStatus(input);
  }
}

export { renderTransactionalEmailHtml } from "./templates";
