# @supastack/supadata-cli

Zero-dependency CLI for the analytics REST surface shipped in `apps/web`
(`/api/v1/*`).

## Auth

| Env var       | Purpose                                               |
| ------------- | ----------------------------------------------------- |
| `SD_BASE_URL` | App origin (default `http://localhost:3000`)          |
| `SD_API_KEY`  | `sd_*` site key or `sk_*` workspace key               |
| `SD_SITE_ID`  | Site id — required when using an `sk_*` workspace key |

Every flag has an env fallback: `--key`, `--site`, `--base-url`.

## Commands

```sh
sd sites list | create --domain example.com [--name X]
sd analytics overview|timeseries|realtime|insights [--period 30d]
sd analytics breakdown <path|source|channel|device|country|browser|os|referrer|hostname|event|medium|campaign|city> [--limit 50]
sd analytics funnel <funnelId>
sd visitors [--search q] [--page n]
sd visitors <visitorId>
sd payments [--period 30d]
sd payments record --amount 1999 --currency usd --email a@b.com [--visitor sdv_…] [--subscription month]
sd goals|funnels|alerts|mentions|keywords|integrations list
sd goals create --name x --type pageview --value /thanks
```

Add `--json` anywhere for raw JSON instead of tables.
