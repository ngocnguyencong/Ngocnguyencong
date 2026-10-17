"use client";

import { useMemo, useState } from "react";

import { fmtMoney, fmtNum } from "../format";
import styles from "./trend-chart.module.css";

export interface TrendPoint {
  date: string;
  visitors: number;
  pageviews: number;
  revenueCents: number;
}

const METRICS = [
  { id: "visitors", label: "Visitors" },
  { id: "pageviews", label: "Pageviews" },
  { id: "revenueCents", label: "Revenue" },
] as const;

type MetricId = (typeof METRICS)[number]["id"];

const W = 800;
const H = 220;
const PAD = { t: 12, r: 8, b: 22, l: 40 };

/** Interactive area chart — metric toggle + hover crosshair. Server data, client UI. */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const [metric, setMetric] = useState<MetricId>("visitors");
  const [hover, setHover] = useState<number | null>(null);

  const { path, area, ticks, maxV } = useMemo(() => {
    const vals = points.map((p) => p[metric]);
    const maxV = Math.max(...vals, 1);
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;
    const x = (i: number) =>
      PAD.l + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (v: number) => PAD.t + (1 - v / maxV) * innerH;
    const line = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[metric]).toFixed(1)}`)
      .join(" ");
    const area =
      points.length > 0
        ? `${line} L${x(points.length - 1).toFixed(1)},${(H - PAD.b).toFixed(1)} L${x(0).toFixed(1)},${(H - PAD.b).toFixed(1)} Z`
        : "";
    const ticks = [0, 0.5, 1].map((f) => ({ v: Math.round(maxV * f), y: y(maxV * f) }));
    return { path: line, area, ticks, maxV };
  }, [points, metric]);

  const label = (p: TrendPoint) =>
    metric === "revenueCents" ? fmtMoney(p.revenueCents) : fmtNum(p[metric]);
  const x = (i: number) =>
    PAD.l +
    (points.length <= 1
      ? (W - PAD.l - PAD.r) / 2
      : (i / (points.length - 1)) * (W - PAD.l - PAD.r));

  const shown = hover !== null ? points[hover] : points[points.length - 1];

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div className={styles.metricGroup} role="group" aria-label="Chart metric">
          {METRICS.map((m) => (
            <button
              aria-pressed={metric === m.id}
              className={`${styles.metric} ${metric === m.id ? styles.metricActive : ""}`}
              key={m.id}
              onClick={() => setMetric(m.id)}
              type="button"
            >
              {m.label}
            </button>
          ))}
        </div>
        {shown && (
          <div className={styles.readout} aria-live="polite">
            <span className={styles.readoutDate}>{shown.date.slice(0, 10)}</span>
            <strong>{label(shown)}</strong>
          </div>
        )}
      </div>
      <div className={styles.plot}>
        <svg
          aria-label={`${metric} over time`}
          className={styles.svg}
          onBlur={() => setHover(null)}
          onFocus={() => setHover(points.length - 1)}
          onKeyDown={(e) => {
            if (points.length === 0) return;
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              const step = e.key === "ArrowRight" ? 1 : -1;
              setHover((h) =>
                Math.max(0, Math.min(points.length - 1, (h ?? points.length - 1) + step)),
              );
            } else if (e.key === "Home") {
              e.preventDefault();
              setHover(0);
            } else if (e.key === "End") {
              e.preventDefault();
              setHover(points.length - 1);
            } else if (e.key === "Escape") {
              setHover(null);
            }
          }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const fx = ((e.clientX - rect.left) / rect.width) * W;
            const i = Math.round(((fx - PAD.l) / (W - PAD.l - PAD.r)) * (points.length - 1));
            setHover(Math.max(0, Math.min(points.length - 1, i)));
          }}
          preserveAspectRatio="none"
          role="img"
          tabIndex={0}
          viewBox={`0 0 ${W} ${H}`}
        >
          <defs>
            <linearGradient id="sdArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <line
              className={styles.gridline}
              key={t.y}
              x1={PAD.l}
              x2={W - PAD.r}
              y1={t.y}
              y2={t.y}
            />
          ))}
          {area && <path d={area} fill="url(#sdArea)" />}
          {path && <path className={styles.line} d={path} />}
          {hover !== null && points[hover] && (
            <line
              className={styles.crosshair}
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.t}
              y2={H - PAD.b}
            />
          )}
        </svg>
        {/* HTML overlays — labels and hover dot stay crisp at any width
            while the svg plot stretches (preserveAspectRatio="none"). */}
        {ticks.map((t) => (
          <span
            className={styles.yTick}
            key={t.y}
            style={{ right: `${(1 - (PAD.l - 6) / W) * 100}%`, top: `${(t.y / H) * 100}%` }}
          >
            {metric === "revenueCents" ? fmtMoney(t.v) : fmtNum(t.v)}
          </span>
        ))}
        {points
          .filter((_, i) => i % Math.ceil(points.length / 6 || 1) === 0)
          .map((p, k) => {
            const idx = points.indexOf(p);
            const shift = idx === 0 ? "0" : idx === points.length - 1 ? "-100%" : "-50%";
            return (
              <span
                className={styles.xTick}
                data-alt={k % 2 === 1 ? "" : undefined}
                key={idx}
                style={{
                  left: `${(x(idx) / W) * 100}%`,
                  top: `${((H - PAD.b + 4) / H) * 100}%`,
                  transform: `translateX(${shift})`,
                }}
              >
                {p.date.slice(5, 10)}
              </span>
            );
          })}
        {hover !== null && points[hover] && (
          <span
            aria-hidden="true"
            className={styles.dot}
            style={{
              left: `${(x(hover) / W) * 100}%`,
              top: `${((PAD.t + (1 - points[hover][metric] / maxV) * (H - PAD.t - PAD.b)) / H) * 100}%`,
            }}
          />
        )}
      </div>
      {/* Full series for assistive tech — the svg only exposes the summary. */}
      <table className="visually-hidden">
        <caption>Daily totals — visitors, pageviews, revenue</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Visitors</th>
            <th scope="col">Pageviews</th>
            <th scope="col">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <th scope="row">{p.date.slice(0, 10)}</th>
              <td>{p.visitors}</td>
              <td>{p.pageviews}</td>
              <td>{fmtMoney(p.revenueCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
