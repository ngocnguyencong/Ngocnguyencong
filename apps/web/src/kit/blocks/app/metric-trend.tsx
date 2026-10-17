import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import styles from "./metric-trend.module.css";

const WIDTH = 96;
const HEIGHT = 32;
const PAD = 3;

/** Round to 2 decimals so SSR output stays clean and stable. */
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Map scalar points into the sparkline viewBox. Scales to the data range like
 * chart-line (trend shape, not magnitude); a flat series draws mid-height.
 */
function toCoords(points: readonly number[]) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min;
  const innerW = WIDTH - PAD * 2;
  const innerH = HEIGHT - PAD * 2;
  return points.map((value, index) => ({
    x: round(points.length === 1 ? WIDTH / 2 : PAD + (index / (points.length - 1)) * innerW),
    y: round(range === 0 ? HEIGHT / 2 : PAD + (1 - (value - min) / range) * innerH),
  }));
}

/**
 * Kit block — KPI stat card with a delta chip and a tiny inline sparkline
 * ("MRR $4.2k ↑ 8%"). The label/value/delta are real text, so no hidden table
 * is needed; the decorative sparkline still gets `role="img"` + an aria-label
 * summarizing the trend. Structural lucide glyphs (same sanctioned deviation
 * as the minimal set). The negative tone falls back to --muted when a product
 * does not define --danger.
 */
export function MetricTrend({
  delta,
  label,
  points,
  value,
}: {
  /**
   * Signed change chip — `direction` picks the icon (`"flat"` renders a
   * neutral `Minus`, no trend arrow). `tone` defaults to direction
   * (up→positive, down→negative, flat→neutral); override it for metrics
   * that improve when they fall (latency, churn): `{ direction: "down",
   * tone: "positive" }`.
   */
  delta: {
    direction: "up" | "down" | "flat";
    text: string;
    tone?: "positive" | "negative" | "neutral" | undefined;
  };
  /** Metric name shown above the value. */
  label: string;
  /** Sparkline series in x order; fewer than two points hides the spark. */
  points: readonly number[];
  /** Big formatted value (already formatted — "1,248", "$4.2k"). */
  value: string;
}) {
  const Icon =
    delta.direction === "up" ? TrendingUp : delta.direction === "down" ? TrendingDown : Minus;
  const tone =
    delta.tone ??
    (delta.direction === "up" ? "positive" : delta.direction === "down" ? "negative" : "neutral");
  const coords = toCoords(points);
  const last = coords.at(-1);

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        <span className={styles.delta} data-tone={tone}>
          <Icon aria-hidden="true" size={13} />
          {delta.text}
        </span>
      </div>
      <div className={styles.main}>
        <strong className={styles.value}>{value}</strong>
        {coords.length > 1 ? (
          <svg
            aria-label={`${label} sparkline: ${coords.length} points, last ${points.at(-1) ?? 0}`}
            className={styles.spark}
            role="img"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          >
            <polyline
              className={styles.sparkLine}
              points={coords.map((coord) => `${coord.x},${coord.y}`).join(" ")}
            />
            {last ? <circle className={styles.sparkDot} cx={last.x} cy={last.y} r={2.5} /> : null}
          </svg>
        ) : null}
      </div>
    </div>
  );
}
