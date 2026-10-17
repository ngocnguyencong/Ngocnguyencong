import {
  OutreachEmailRejectedError,
  EmailDeliveryStatusStore,
  TransactionalEmailDeliveryError,
  type DeliveryStatusQuery,
  type EmailDelivery,
  type EmailDeliveryStatus,
  type EmailMessage,
  type EmailSender,
} from "./index";

/**
 * The subset of `EmailClient` from `@opencoredev/email-sdk` the sender needs.
 * Build the client with `createEmailClient({ adapters, telemetry: false })` in
 * the application composition root — SDK telemetry is disabled in every path,
 * and deployments can additionally set `EMAIL_SDK_TELEMETRY=0`/`DO_NOT_TRACK=1`.
 */
export interface EmailSdkSendClient {
  send(message: EmailSdkMessage): Promise<EmailSdkSendResult>;
}

export type EmailSdkMessage = Readonly<{
  from: string;
  to: readonly string[];
  subject: string;
  text: string;
  html?: string;
}>;

export type EmailSdkSendResult = Readonly<{
  adapter?: string;
  id?: string;
}>;

export type EmailSdkProviderName = "brevo" | "mailgun" | "postmark" | "sendgrid" | "smtp";

/**
 * Server-side adapter over `@opencoredev/email-sdk` transports (Postmark,
 * SendGrid, Mailgun, SMTP, Brevo). Same `EmailSender` contract as the Resend
 * and SES senders: one transactional delivery at a time, no outreach.
 */
export class EmailSdkTransactionalEmailSender implements EmailSender {
  private readonly deliveries = new EmailDeliveryStatusStore();

  constructor(
    private readonly client: EmailSdkSendClient,
    private readonly from: string,
    private readonly provider: EmailSdkProviderName,
  ) {}

  async send(input: EmailMessage): Promise<EmailDelivery> {
    if (input.category !== "transactional") {
      throw new OutreachEmailRejectedError();
    }

    const result = await this.client.send({
      from: this.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      ...(input.html === undefined ? {} : { html: input.html }),
    });

    if (result.id === undefined || result.id === "") {
      throw new TransactionalEmailDeliveryError(this.provider);
    }

    const delivery: EmailDelivery = {
      id: result.id,
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

  async getStatus(input: DeliveryStatusQuery): Promise<EmailDeliveryStatus | undefined> {
    return this.deliveries.get(input);
  }
}
