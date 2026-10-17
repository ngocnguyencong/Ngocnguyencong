#!/usr/bin/env node
/* global process, URL, fetch, console */
/**
 * supadata CLI — thin client over the kit's /api/v1 analytics surface.
 * Zero dependencies (Node >= 18 fetch). See README.md for auth + commands.
 */

const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--json") flags.json = true;
  else if (a.startsWith("--")) flags[a.slice(2)] = args[++i];
  else positional.push(a);
}

const BASE = (flags["base-url"] ?? process.env.SD_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const KEY = flags.key ?? process.env.SD_API_KEY ?? "";
const SITE = flags.site ?? process.env.SD_SITE_ID ?? "";

function die(msg, code = 1) {
  console.error(`sd: ${msg}`);
  process.exit(code);
}

if (!KEY) die("missing credentials — set SD_API_KEY or pass --key");

async function call(path, { method = "GET", body } = {}) {
  const url = new URL(BASE + path);
  if (SITE && !url.searchParams.has("site_id")) url.searchParams.set("site_id", SITE);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    die(`HTTP ${res.status} — non-JSON response`);
  }
  if (!res.ok) die(`HTTP ${res.status} — ${json?.error?.message ?? json?.message ?? text}`);
  return json?.data ?? json;
}

function print(data) {
  if (flags.json) return console.log(JSON.stringify(data, null, 2));
  const rows = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : null;
  if (!rows || rows.length === 0 || typeof rows[0] !== "object") {
    return console.log(typeof data === "object" ? JSON.stringify(data, null, 2) : String(data));
  }
  const cols = Object.keys(rows[0]).slice(0, 8);
  const widths = cols.map((c) =>
    Math.max(c.length, ...rows.slice(0, 40).map((r) => String(r[c] ?? "").length)),
  );
  console.log(cols.map((c, i) => c.padEnd(widths[i])).join("  "));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of rows.slice(0, 40)) {
    console.log(
      cols
        .map((c, i) =>
          String(r[c] ?? "")
            .slice(0, widths[i])
            .padEnd(widths[i]),
        )
        .join("  "),
    );
  }
  if (rows.length > 40) console.log(`… ${rows.length - 40} more`);
}

const [group, ...rest] = positional;
const sub = rest[0];
const period = flags.period ? `&period=${flags.period}` : "";
const limit = flags.limit ? `&limit=${flags.limit}` : "";

const routes = {
  "sites list": () => `/api/v1/sites`,
  "sites create": () => `/api/v1/sites`,
  "analytics overview": () => `/api/v1/analytics/overview?x=1${period}`,
  "analytics timeseries": () => `/api/v1/analytics/timeseries?x=1${period}`,
  "analytics realtime": () => `/api/v1/analytics/realtime?x=1`,
  "analytics insights": () => `/api/v1/analytics/insights?x=1${period}`,
  "analytics breakdown": () => {
    if (!rest[1]) die("usage: sd analytics breakdown <dimension>");
    return `/api/v1/analytics/${rest[1]}?x=1${period}${limit}`;
  },
  "analytics funnel": () => {
    if (!rest[1]) die("usage: sd analytics funnel <funnelId>");
    return `/api/v1/analytics/funnel-results?funnel=${rest[1]}${period}`;
  },
  visitors: () =>
    sub && !sub.startsWith("-")
      ? `/api/v1/visitors/${sub}`
      : `/api/v1/visitors?x=1${flags.search ? `&search=${flags.search}` : ""}${flags.page ? `&page=${flags.page}` : ""}`,
  "payments list": () => `/api/v1/payments?x=1${period}`,
  "payments record": () => `/api/v1/payments`,
};

const GETS = {
  goals: "goals",
  funnels: "funnels",
  alerts: "alerts",
  mentions: "mentions",
  keywords: "keywords",
  integrations: "integrations",
};

async function main() {
  if (group === "payments" && sub === "record") {
    if (!flags.amount)
      die(
        "usage: sd payments record --amount <cents> [--currency usd] [--email x] [--visitor id] [--subscription month|year|once]",
      );
    return print(
      await call(`/api/v1/payments`, {
        method: "POST",
        body: {
          amount_cents: Number(flags.amount),
          currency: flags.currency ?? "usd",
          email: flags.email,
          visitor_id: flags.visitor,
          interval: flags.subscription ?? "once",
          product_name: flags.product,
        },
      }),
    );
  }
  if (group === "sites" && sub === "create") {
    if (!flags.domain) die("usage: sd sites create --domain example.com [--name X]");
    return print(
      await call(`/api/v1/sites`, {
        method: "POST",
        body: { domain: flags.domain, name: flags.name },
      }),
    );
  }
  if (group === "goals" && sub === "create") {
    if (!flags.name || !flags.type)
      die("usage: sd goals create --name x --type pageview|event [--value /thanks]");
    return print(
      await call(`/api/v1/goals`, {
        method: "POST",
        body: { name: flags.name, type: flags.type, value: flags.value },
      }),
    );
  }
  if (GETS[group]) return print(await call(`/api/v1/${GETS[group]}?x=1${period}${limit}`));
  const route = routes[`${group} ${sub ?? ""}`.trim()] ?? routes[group];
  if (!route) {
    console.error(
      "usage: sd <sites|analytics|visitors|payments|goals|funnels|alerts|mentions|keywords|integrations> …",
    );
    console.error("       sd --help  → see README.md");
    process.exit(1);
  }
  return print(await call(route()));
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
