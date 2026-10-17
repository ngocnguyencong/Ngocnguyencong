"use client";

import { useState } from "react";

import { fmtMoney, fmtNum } from "../format";
import styles from "./breakdown.module.css";

export interface BreakdownRow {
  value: string;
  visitors: number;
  pageviews: number;
  revenueCents: number;
}

export interface BreakdownGroup {
  id: string;
  label: string;
  rows: BreakdownRow[];
}

/** Tabbed "dimension" table — Pages/Sources/Channels/etc. with fill bars. */
export function BreakdownPanel({
  groups,
  showRevenue = true,
}: {
  groups: BreakdownGroup[];
  showRevenue?: boolean;
}) {
  const [active, setActive] = useState(0);
  const group = groups[active] ?? groups[0];
  if (!group) return null;
  const max = Math.max(...group.rows.map((r) => r.visitors), 1);
  const total = group.rows.reduce((s, r) => s + r.visitors, 0) || 1;

  return (
    <div className={styles.card}>
      <div className={styles.tabs} role="tablist">
        {groups.map((g, i) => (
          <button
            aria-selected={i === active}
            className={`${styles.tab} ${i === active ? styles.tabActive : ""}`}
            key={g.id}
            onClick={() => setActive(i)}
            role="tab"
            type="button"
          >
            {g.label}
          </button>
        ))}
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{group.label}</th>
            <th className={styles.num}>Visitors</th>
            <th className={styles.num}>Views</th>
            {showRevenue && <th className={styles.num}>Revenue</th>}
            <th className={styles.num}>%</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.length === 0 && (
            <tr>
              <td className={styles.empty} colSpan={showRevenue ? 5 : 4}>
                No data in this range.
              </td>
            </tr>
          )}
          {group.rows.map((r) => (
            <tr key={r.value}>
              <td className={styles.dimCell}>
                <span
                  aria-hidden
                  className={styles.fill}
                  style={{ width: `${(r.visitors / max) * 100}%` }}
                />
                <span className={styles.dim} title={r.value || "(none)"}>
                  {r.value || "(none)"}
                </span>
              </td>
              <td className={styles.num}>{fmtNum(r.visitors)}</td>
              <td className={styles.num}>{fmtNum(r.pageviews)}</td>
              {showRevenue && (
                <td className={styles.num}>{r.revenueCents ? fmtMoney(r.revenueCents) : "—"}</td>
              )}
              <td className={`${styles.num} ${styles.pct}`}>
                {Math.round((r.visitors / total) * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
