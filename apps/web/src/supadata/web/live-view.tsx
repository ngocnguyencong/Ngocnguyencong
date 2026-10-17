"use client";

import { useEffect, useState } from "react";

import { fmtDateTime } from "../format";
import styles from "./live-view.module.css";

interface LiveVisitor {
  visitorId: string;
  country: string | null;
  device: string | null;
  browser: string | null;
  page: string | null;
  lastSeenAt: string;
  email: string | null;
  name: string | null;
}

const FLAG: Record<string, string> = {
  us: "🇺🇸",
  gb: "🇬🇧",
  de: "🇩🇪",
  fr: "🇫🇷",
  es: "🇪🇸",
  it: "🇮🇹",
  nl: "🇳🇱",
  br: "🇧🇷",
  ca: "🇨🇦",
  au: "🇦🇺",
  in: "🇮🇳",
  jp: "🇯🇵",
  kr: "🇰🇷",
  cn: "🇨🇳",
  se: "🇸🇪",
  no: "🇳🇴",
  fi: "🇫🇮",
  dk: "🇩🇰",
  pl: "🇵🇱",
  pt: "🇵🇹",
  ie: "🇮🇪",
};

function flag(country: string | null): string {
  return country ? (FLAG[country.toLowerCase()] ?? country.toUpperCase()) : "🌐";
}

export function LiveView({
  siteId,
  initial,
}: {
  siteId: string;
  initial: { online: number; visitors: LiveVisitor[] };
}) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/analytics/realtime?site_id=${siteId}`);
        if (res.ok) {
          const json = (await res.json()) as {
            status: string;
            data: { online: number; visitors: LiveVisitor[] };
          };
          if (json.status === "ok") setData(json.data);
        }
      } catch {
        // keep stale data
      }
    };
    const id = setInterval(() => void poll(), 5000);
    return () => clearInterval(id);
  }, [siteId]);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span aria-hidden className={styles.pulse} />
        <strong>{data.online}</strong> visitor{data.online === 1 ? "" : "s"} online
        <span className={styles.hint}>updates every 5s</span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Visitor</th>
            <th>Page</th>
            <th>Device</th>
            <th>Browser</th>
            <th className={styles.num}>Last seen</th>
          </tr>
        </thead>
        <tbody>
          {data.visitors.length === 0 && (
            <tr>
              <td className={styles.empty} colSpan={5}>
                Nobody on the site right now.
              </td>
            </tr>
          )}
          {data.visitors.map((v) => (
            <tr key={v.visitorId}>
              <td>
                <a
                  className={styles.visitor}
                  href={`/dashboard/visitors/${v.visitorId}?site=${siteId}`}
                >
                  <span aria-hidden>{flag(v.country)}</span>{" "}
                  {v.name || v.email || v.visitorId.slice(0, 8)}
                </a>
              </td>
              <td className={styles.page}>{v.page}</td>
              <td>{v.device}</td>
              <td>{v.browser}</td>
              <td className={styles.num}>{fmtDateTime(v.lastSeenAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
