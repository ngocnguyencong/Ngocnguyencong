import { sdIntegration, sdSiteKey } from "@supastack/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { database } from "../../../src/auth-runtime";
import { DashboardFrame } from "../../../src/supadata/web/frame";
import {
  CreateSiteForm,
  SharePanel,
  SiteKeyPanel,
  SiteSettingsForm,
} from "../../../src/supadata/web/forms";
import styles from "../../../src/supadata/web/forms.module.css";

export const dynamic = "force-dynamic";

export default async function SiteSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host.split(",")[0]!.trim()}`;
  return (
    <DashboardFrame siteParam={sp.site ?? null}>
      {async (ctx) => {
        if (!ctx.site) {
          return <CreateSiteForm />;
        }
        const site = ctx.site;
        const [keys, integrations] = await Promise.all([
          database.select().from(sdSiteKey).where(eq(sdSiteKey.siteId, site.id)),
          database.select().from(sdIntegration).where(eq(sdIntegration.siteId, site.id)),
        ]);
        const snippet = `<script defer data-website-id="${site.id}"${site.cookieless ? ' data-cookieless="true"' : ""} src="${origin}/sd.js"></script>`;
        return (
          <>
            <div className={styles.card}>
              <h3 className={styles.title}>Tracking snippet</h3>
              <p className={styles.note}>
                Paste before <code>&lt;/head&gt;</code> on <strong>{site.domain}</strong>:
              </p>
              <pre
                style={{
                  background: "var(--section)",
                  padding: 12,
                  borderRadius: 8,
                  overflowX: "auto",
                  fontSize: 12,
                }}
              >
                {snippet}
              </pre>
              <p className={styles.note}>
                Custom events: <code>supadata(&quot;goal&quot;, &quot;signup_click&quot;)</code> ·
                Goals by attribute: <code>data-sd-goal=&quot;name&quot;</code> · Scroll depth:{" "}
                <code>&lt;body data-sd-scroll&gt;</code>
              </p>
            </div>
            <SiteSettingsForm
              site={{
                id: site.id,
                name: site.name,
                timezone: site.timezone,
                allowedHostnames: site.allowedHostnames,
                cookieless: site.cookieless,
              }}
            />
            <SiteKeyPanel keys={keys} siteId={site.id} />
            <SharePanel origin={origin} shareId={site.shareId} siteId={site.id} />
            <div className={styles.card}>
              <h3 className={styles.title}>Integrations</h3>
              {integrations.length === 0 ? (
                <p className={styles.note}>
                  No integrations connected. Revenue flows in via{" "}
                  <code>
                    POST /api/v1/webhooks/{"{stripe|lemonsqueezy|polar|paddle|dodo}"}?site_id=
                    {site.id}
                  </code>{" "}
                  or the Payments API.
                </p>
              ) : (
                <ul className={styles.list}>
                  {integrations.map((i) => (
                    <li className={styles.listRow} key={i.id}>
                      <strong>{i.provider}</strong>
                      <span className={styles.dim}>{i.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        );
      }}
    </DashboardFrame>
  );
}
