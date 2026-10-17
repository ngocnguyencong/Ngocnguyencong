import "server-only";

import { sdPayment, sdVisitor } from "@supastack/db";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { database } from "../auth-runtime";
import { sdId } from "./id";

const paymentSchema = z.object({
  site_id: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().length(3).default("usd"),
  visitor_id: z.string().nullish(),
  email: z.string().email().nullish(),
  user_id: z.string().nullish(),
  transaction_id: z.string().nullish(),
  renewal: z.boolean().default(false),
  refunded: z.boolean().default(false),
  subscription: z
    .object({
      interval: z.enum(["month", "year", "week", "once"]).default("month"),
      interval_count: z.number().int().positive().default(1),
      plan_name: z.string().nullish(),
    })
    .nullish(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

/** Normalize an incoming API payment payload. */
export function parsePaymentInput(raw: unknown) {
  const parsed = paymentSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

type Obj = Record<string, unknown>;
const rec = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const txt = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const arr0 = (v: unknown): Obj => (Array.isArray(v) ? rec(v[0]) : {});

function toMrrCents(amountCents: number, interval: string): number {
  if (interval === "month") return amountCents;
  if (interval === "year") return Math.round(amountCents / 12);
  if (interval === "week") return Math.round(amountCents * 4.33);
  return 0;
}

export interface RecordPaymentResult {
  id: string;
  attributed: boolean;
  channel: string | null;
}

/**
 * Records a payment/refund and attributes it via the matched visitor's
 * last-touch session (channel/source/medium/campaign). Idempotent on
 * (site_id, external_id).
 */
export async function recordPayment(
  siteId: string,
  input: {
    amountCents: number;
    currency?: string;
    email?: string | null;
    visitorRef?: string | null;
    userId?: string | null;
    externalId?: string | null;
    provider?: string;
    kind?: "payment" | "refund";
    interval?: string;
    productName?: string | null;
    occurredAt?: Date;
  },
): Promise<RecordPaymentResult | null> {
  const occurredAt = input.occurredAt ?? new Date();
  const externalId = input.externalId ?? null;
  if (externalId) {
    const [dupe] = await database
      .select({ id: sdPayment.id })
      .from(sdPayment)
      .where(and(eq(sdPayment.siteId, siteId), eq(sdPayment.externalId, externalId)))
      .limit(1);
    if (dupe) return { id: dupe.id, attributed: false, channel: null };
  }

  // Match visitor: tracker id → user_id → email (most recent).
  const visitor = await (async () => {
    if (input.visitorRef) {
      const [v] = await database
        .select()
        .from(sdVisitor)
        .where(
          and(
            eq(sdVisitor.siteId, siteId),
            // tracker visitor ids land in visitor_key unless cookieless
            eq(sdVisitor.visitorKey, input.visitorRef),
          ),
        )
        .limit(1);
      if (v) return v;
    }
    if (input.userId) {
      const [v] = await database
        .select()
        .from(sdVisitor)
        .where(and(eq(sdVisitor.siteId, siteId), eq(sdVisitor.userId, input.userId)))
        .limit(1);
      if (v) return v;
    }
    if (input.email) {
      const rows = await database
        .select()
        .from(sdVisitor)
        .where(and(eq(sdVisitor.siteId, siteId), eq(sdVisitor.email, input.email)))
        .limit(1);
      return rows[0];
    }
    return undefined;
  })();

  // Last-touch: newest session of that visitor.
  let channel: string | null = null;
  let source: string | null = null;
  let medium: string | null = null;
  let campaign: string | null = null;
  let referrer: string | null = null;
  if (visitor) {
    const sess = await database.execute(sql`
      SELECT channel, source, medium, campaign, referrer
      FROM sd_session WHERE visitor_id = ${visitor.id}
      ORDER BY last_activity_at DESC LIMIT 1
    `);
    const s = sess[0] as
      | {
          channel: string | null;
          source: string | null;
          medium: string | null;
          campaign: string | null;
          referrer: string | null;
        }
      | undefined;
    channel = s?.channel ?? null;
    source = s?.source ?? null;
    medium = s?.medium ?? null;
    campaign = s?.campaign ?? null;
    referrer = s?.referrer ?? null;
  }

  const interval = input.interval ?? "once";
  const amountCents = Math.round(input.amountCents);
  const kind = input.kind ?? "payment";
  const [row] = await database
    .insert(sdPayment)
    .values({
      id: sdId(),
      siteId,
      visitorId: visitor?.id ?? null,
      email: input.email ?? null,
      provider: input.provider ?? "api",
      externalId,
      kind,
      amountCents,
      currency: (input.currency ?? "usd").toLowerCase(),
      interval,
      mrrCents: kind === "payment" ? toMrrCents(amountCents, interval) : 0,
      productName: input.productName ?? null,
      status: "active",
      channel,
      source,
      medium,
      campaign,
      referrer,
      occurredAt,
    })
    .returning({ id: sdPayment.id });

  if (visitor && kind === "payment") {
    await database
      .update(sdVisitor)
      .set({
        isCustomer: true,
        revenueCents: visitor.revenueCents + amountCents,
        updatedAt: new Date(),
      })
      .where(eq(sdVisitor.id, visitor.id));
  }
  if (visitor?.email === null && input.email) {
    await database
      .update(sdVisitor)
      .set({ email: input.email })
      .where(eq(sdVisitor.id, visitor.id));
  }
  return { id: row?.id ?? "", attributed: visitor !== undefined, channel };
}

// ---------- provider webhook normalizers ----------

export interface NormalizedPayment {
  externalId: string | null;
  email: string | null;
  visitorRef: string | null;
  userId: string | null;
  amountCents: number;
  currency: string;
  interval: string;
  productName: string | null;
  kind: "payment" | "refund";
}

/** Extract the visitor handoff our tracker stashes in payment metadata/checkout params. */
function dfVisitorFrom(meta: unknown): { visitorRef: string | null; userId: string | null } {
  if (!meta || typeof meta !== "object") return { visitorRef: null, userId: null };
  const m = meta as Record<string, unknown>;
  const ref = txt(m.sd_visitor_id) ?? txt(m.datafast_visitor_id) ?? txt(m.visitor_id);
  const uid = txt(m.user_id);
  return { visitorRef: ref, userId: uid };
}

export function normalizeProviderPayload(
  provider: string,
  payload: unknown,
): NormalizedPayment | null {
  const p = rec(payload);
  try {
    if (provider === "stripe") {
      const obj = rec(rec(p.data).object ?? payload);
      const type = txt(p.type) ?? "";
      if (
        !/checkout\.session\.completed|charge\.succeeded|invoice\.paid|charge\.refunded/.test(type)
      )
        return null;
      const meta = dfVisitorFrom(
        obj.client_reference_id
          ? { visitor_id: obj.client_reference_id, ...rec(obj.metadata) }
          : obj.metadata,
      );
      const refund = type === "charge.refunded";
      return {
        externalId: txt(obj.id) ?? txt(obj.payment_intent),
        email:
          txt(rec(obj.customer_details).email) ?? txt(obj.customer_email) ?? txt(obj.receipt_email),
        visitorRef: meta.visitorRef,
        userId: meta.userId,
        amountCents: num(obj.amount_total ?? obj.amount ?? obj.amount_refunded),
        currency: txt(obj.currency) ?? "usd",
        interval: obj.mode === "subscription" ? "month" : "once",
        productName: txt(rec(rec(arr0(obj.display_items)).custom).name) ?? txt(obj.description),
        kind: refund ? "refund" : "payment",
      };
    }
    if (provider === "lemonsqueezy") {
      const attrs = rec(rec(p.data).attributes);
      const meta = dfVisitorFrom(attrs.custom_data ?? rec(p.meta).custom_data);
      return {
        externalId: txt(rec(p.data).id),
        email: txt(attrs.user_email) ?? txt(attrs.customer_email),
        visitorRef: meta.visitorRef,
        userId: meta.userId,
        amountCents: num(attrs.total ?? attrs.subtotal),
        currency: (txt(attrs.currency) ?? "usd").toLowerCase(),
        interval:
          attrs.renewal === true || (txt(rec(p.meta).event_name)?.includes("subscription") ?? false)
            ? "month"
            : "once",
        productName: txt(attrs.product_name) ?? txt(rec(attrs.first_order_item).product_name),
        kind: num(attrs.total) < 0 ? "refund" : "payment",
      };
    }
    if (provider === "polar") {
      const d = rec(p.data);
      const meta = dfVisitorFrom(d.metadata ?? p.metadata);
      return {
        externalId: txt(d.id),
        email: txt(rec(d.customer).email) ?? txt(d.email),
        visitorRef: meta.visitorRef,
        userId: meta.userId,
        amountCents: num(d.amount ?? d.total_amount),
        currency: (txt(d.currency) ?? "usd").toLowerCase(),
        interval: txt(d.recurring_interval) ?? (d.subscription_id ? "month" : "once"),
        productName: txt(rec(d.product).name),
        kind: p.type === "order.refunded" ? "refund" : "payment",
      };
    }
  } catch {
    return null;
  }
  return null;
}
