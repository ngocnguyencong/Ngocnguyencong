/** Event types a workspace endpoint can subscribe to. `ping` verifies wiring. */
export const WEBHOOK_EVENTS = Object.freeze([
  "ai.task_completed",
  "billing.processed",
  "commerce.order_created",
  "commerce.order_status_changed",
  "connected_account.disconnected",
  "content.published",
  "domain.verified",
  "feature_request.created",
  "feature_request.status_changed",
  "invite.accepted",
  "member.joined",
  "member.removed",
  "ping",
] as const);

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

export function isWebhookEventType(value: string): value is WebhookEventType {
  return (WEBHOOK_EVENTS as readonly string[]).includes(value);
}
