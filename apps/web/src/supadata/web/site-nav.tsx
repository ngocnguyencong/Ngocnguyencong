"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select } from "../../ui/primitives";
import styles from "./site-nav.module.css";

const TABS = [
  ["Overview", "/dashboard"],
  ["Live", "/dashboard/live"],
  ["Visitors", "/dashboard/visitors"],
  ["Revenue", "/dashboard/insights"],
  ["Goals", "/dashboard/goals"],
  ["Funnels", "/dashboard/funnels"],
  ["Alerts", "/dashboard/alerts"],
  ["Mentions", "/dashboard/mentions"],
  ["Settings", "/dashboard/settings"],
] as const;

const PERIODS = [
  ["24h", "Today"],
  ["7d", "7D"],
  ["30d", "30D"],
  ["90d", "90D"],
  ["12m", "12M"],
] as const;

export function SiteNav({
  sites,
  activeSiteId,
}: {
  sites: { id: string; name: string; domain: string }[];
  activeSiteId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const period = params.get("period") ?? "30d";

  function hrefFor(mutate: (p: URLSearchParams) => void, path = pathname) {
    const p = new URLSearchParams(params.toString());
    mutate(p);
    return `${path}?${p.toString()}`;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        {/* GET form keeps site switching working without JS; the themed Select
            enhances the native control and fires onChange for instant nav. */}
        <form action={pathname} className={styles.sitePicker} method="get">
          {[...params.entries()]
            .filter(([key]) => key !== "site")
            .map(([key, value]) => (
              <input key={key} name={key} type="hidden" value={value} />
            ))}
          <Select
            aria-label="Site"
            defaultValue={activeSiteId}
            name="site"
            onChange={(e) => router.push(hrefFor((p) => p.set("site", e.target.value)))}
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || s.domain}
              </option>
            ))}
          </Select>
          <noscript>
            <button className={styles.siteGo} type="submit">
              Go
            </button>
          </noscript>
        </form>
        <nav aria-label="Dashboard sections" className={styles.tabs}>
          {TABS.map(([label, href]) => {
            const active =
              pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <a
                aria-current={active ? "page" : undefined}
                className={`${styles.tab} ${active ? styles.tabActive : ""}`}
                href={hrefFor(() => {}, href)}
                key={href}
              >
                {label}
              </a>
            );
          })}
        </nav>
        <nav aria-label="Period" className={styles.periods}>
          {PERIODS.map(([id, label]) => {
            const active = period === id;
            return (
              <a
                aria-current={active ? "page" : undefined}
                className={`${styles.period} ${active ? styles.periodActive : ""}`}
                href={hrefFor((p) => p.set("period", id))}
                key={id}
              >
                {label}
              </a>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
