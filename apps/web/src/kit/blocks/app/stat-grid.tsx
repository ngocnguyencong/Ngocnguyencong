import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import styles from "./stat-grid.module.css";

export type StatItem = {
  label: string;
  value: string;
  hint?: string | undefined;
  /**
   * Optional period-over-period delta. `change` is a fraction (0.12 = +12%);
   * null or |change| < 0.005 renders a neutral "—". `goodWhen` decides whether
   * the direction earns the success or danger tone ("down" for bounce rate).
   */
  delta?: { change: number | null; goodWhen: "up" | "down" } | undefined;
};

function DeltaChip({ change, goodWhen }: NonNullable<StatItem["delta"]>) {
  const flat = change === null || Math.abs(change) < 0.005;
  const up = change !== null && change > 0;
  const good = up ? goodWhen === "up" : goodWhen === "down";
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={styles.delta} data-tone={flat ? "flat" : good ? "good" : "bad"}>
      <Icon aria-hidden="true" size={13} />
      {flat ? "—" : `${change > 0 ? "+" : ""}${Math.round(change * 100)}%`}
      <span className="visually-hidden"> vs previous period</span>
    </span>
  );
}

/** Kit block — KPI stat cards for dashboard tops. */
export function StatGrid({ items }: { items: readonly StatItem[] }) {
  return (
    <div className={styles.wrap}>
      <ul className={styles.grid} data-count={items.length}>
        {items.map((item) => (
          <li className={styles.card} key={item.label}>
            <span className={styles.head}>
              <span className={styles.label}>{item.label}</span>
              {item.delta ? <DeltaChip {...item.delta} /> : null}
            </span>
            <strong className={styles.value}>{item.value}</strong>
            {item.hint ? <span className={styles.hint}>{item.hint}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
