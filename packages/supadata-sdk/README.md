# @supastack/supadata-sdk

Minimal SDK for the analytics surface shipped in `apps/web`.

## Browser tracking — `<SupadataScript>`

```tsx
import { SupadataScript } from "@supastack/supadata-sdk/react";

<SupadataScript websiteId="sdid_…" />; // emits the deferred tracker tag
```

Props map to the tracker's `data-*` attributes: `apiUrl`, `domain`,
`cookieless`.

## Server — `SupadataClient`

```ts
import { SupadataClient } from "@supastack/supadata-sdk";

const sd = new SupadataClient({
  baseUrl: "https://app.example.com",
  apiKey: process.env.SD_API_KEY!, // sd_* site key or sk_* workspace key
  siteId: "sdid_…", // required with sk_* workspace keys
});

await sd.overview({ period: "30d" });
await sd.recordPayment({ amount_cents: 1999, currency: "usd", email: "a@b.com" });
```

Methods mirror `/api/v1` routes: `overview`, `timeseries`, `realtime`,
`insights`, `breakdown`, `funnelResults`, `visitors`, `visitor`,
`payments`, `recordPayment`, `identify`, `sites`, `createSite`, and the
resource listers (`goals`, `funnels`, `alerts`, `mentions`, `keywords`,
`integrations`).
