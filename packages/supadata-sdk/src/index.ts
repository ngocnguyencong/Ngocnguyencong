/**
 * SupadataClient — typed server-side client over the /api/v1 analytics
 * surface. Zero dependencies (Node >= 18 fetch).
 */

export interface SupadataClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Required when the api key is a workspace-level sk_ key. */
  siteId?: string;
}

export interface PaymentInput {
  amount_cents: number;
  currency?: string;
  email?: string;
  visitor_id?: string;
  user_id?: string;
  external_id?: string;
  interval?: string;
  product_name?: string;
  occurred_at?: string;
}

export interface SiteInput {
  domain: string;
  name?: string;
}

type Query = Record<string, string | number | undefined>;

export class SupadataClient {
  readonly #baseUrl: string;
  readonly #apiKey: string;
  readonly #siteId: string | undefined;

  constructor(opts: SupadataClientOptions) {
    this.#baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.#apiKey = opts.apiKey;
    this.#siteId = opts.siteId;
  }

  async #call<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const url = new URL(this.#baseUrl + path);
    if (this.#siteId && !url.searchParams.has("site_id"))
      url.searchParams.set("site_id", this.#siteId);
    const res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: {
        authorization: `Bearer ${this.#apiKey}`,
        ...(init?.body ? { "content-type": "application/json" } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : null,
    });
    const json = (await res.json().catch(() => null)) as {
      data?: T;
      error?: { message?: string };
      message?: string;
    } | null;
    if (!res.ok) throw new Error(json?.error?.message ?? json?.message ?? `HTTP ${res.status}`);
    return (json && typeof json === "object" && "data" in json ? json.data : json) as T;
  }

  #qs(q: Query): string {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined) p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : "";
  }

  overview(o?: { period?: string }) {
    return this.#call(`/api/v1/analytics/overview${this.#qs({ period: o?.period })}`);
  }
  timeseries(o?: { period?: string; metric?: string }) {
    return this.#call(
      `/api/v1/analytics/timeseries${this.#qs({ period: o?.period, metric: o?.metric })}`,
    );
  }
  realtime() {
    return this.#call(`/api/v1/analytics/realtime`);
  }
  insights(o?: { period?: string }) {
    return this.#call(`/api/v1/analytics/insights${this.#qs({ period: o?.period })}`);
  }
  breakdown(dimension: string, o?: { period?: string; limit?: number }) {
    return this.#call(
      `/api/v1/analytics/${dimension}${this.#qs({ period: o?.period, limit: o?.limit })}`,
    );
  }
  funnelResults(funnelId: string, o?: { period?: string }) {
    return this.#call(
      `/api/v1/analytics/funnel-results${this.#qs({ funnel: funnelId, period: o?.period })}`,
    );
  }
  visitors(o?: { search?: string; page?: number }) {
    return this.#call(`/api/v1/visitors${this.#qs({ search: o?.search, page: o?.page })}`);
  }
  visitor(id: string) {
    return this.#call(`/api/v1/visitors/${id}`);
  }
  payments(o?: { period?: string }) {
    return this.#call(`/api/v1/payments${this.#qs({ period: o?.period })}`);
  }
  recordPayment(input: PaymentInput) {
    return this.#call(`/api/v1/payments`, { method: "POST", body: input });
  }
  identify(input: {
    visitor_id: string;
    email?: string;
    user_id?: string;
    traits?: Record<string, unknown>;
  }) {
    return this.#call(`/api/v1/identify`, { method: "POST", body: input });
  }
  sites() {
    return this.#call(`/api/v1/sites`);
  }
  createSite(input: SiteInput) {
    return this.#call(`/api/v1/sites`, { method: "POST", body: input });
  }
  goals() {
    return this.#call(`/api/v1/goals`);
  }
  funnels() {
    return this.#call(`/api/v1/funnels`);
  }
  alerts() {
    return this.#call(`/api/v1/alerts`);
  }
  mentions() {
    return this.#call(`/api/v1/mentions`);
  }
  keywords() {
    return this.#call(`/api/v1/keywords`);
  }
  integrations() {
    return this.#call(`/api/v1/integrations`);
  }
}
