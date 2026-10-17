import styles from "./chart-line.module.css";

export type LinePoint = {
  /** X-axis label — row header in the visually-hidden data table. */
  label: string;
  /** Numeric value plotted on the data-scaled y-axis. */
  value: number;
};

const WIDTH = 320;
const HEIGHT = 160;
const PAD_X = 6;
const PAD_Y = 10;

/** Round to 2 decimals so SSR output stays clean and stable. */
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Map points into the 320×160 viewBox. The y-axis scales to the data range
 * (min at the bottom, max at the top) — it does NOT start at zero, so the
 * chart emphasizes trend shape over absolute magnitude. A flat series draws
 * a mid-height line instead of dividing by zero.
 */
function toCoords(points: readonly LinePoint[]) {
  const values = points.map((point) => point.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_Y * 2;
  return points.map((point, index) => ({
    label: point.label,
    x: round(points.length === 1 ? WIDTH / 2 : PAD_X + (index / (points.length - 1)) * innerW),
    y: round(range === 0 ? HEIGHT / 2 : PAD_Y + (1 - (point.value - min) / range) * innerH),
  }));
}

function trendWord(points: readonly LinePoint[]): string {
  const first = points.at(0)?.value ?? 0;
  const last = points.at(-1)?.value ?? 0;
  if (last > first) return "rising";
  if (last < first) return "falling";
  return "flat";
}

/**
 * Kit block — dependency-free SVG line chart for marketing stats (signup
 * sparklines, traffic trends). Pure TS point→coord mapping, no chart library.
 *
 * The y-axis is scaled to the data max/min, not zero — fine for trend
 * storytelling, wrong for magnitude comparisons (use bars there). Screen
 * readers get a visually-hidden `<table>` with every point; the svg carries a
 * `role="img"` trend summary. Static by design — no animation, fails open.
 */
export function ChartLine({
  label,
  points,
  tone = "primary",
}: {
  /** Chart name — visible caption, table caption, and aria-label prefix. */
  label: string;
  /** Series points in x order. An empty series renders a muted "no data" note. */
  points: readonly LinePoint[];
  /** "primary" strokes --accent; "muted" strokes --muted for quieter context. */
  tone?: "primary" | "muted" | undefined;
}) {
  const coords = toCoords(points);
  const ariaLabel =
    coords.length === 0
      ? `${label}: no data`
      : `${label}: ${coords.length === 1 ? "1 point" : `${coords.length} points`}, ${trendWord(
          points,
        )}, last value ${points.at(-1)?.value ?? 0}`;

  return (
    <figure className={styles.chart} data-tone={tone}>
      <figcaption className={styles.caption}>{label}</figcaption>
      {coords.length === 0 ? (
        <p className={styles.empty}>No data yet.</p>
      ) : (
        <svg
          aria-label={ariaLabel}
          className={styles.svg}
          role="img"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        >
          <line
            className={styles.baseline}
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={HEIGHT - PAD_Y}
            y2={HEIGHT - PAD_Y}
          />
          {coords.length > 1 ? (
            <polyline
              className={styles.line}
              points={coords.map((coord) => `${coord.x},${coord.y}`).join(" ")}
            />
          ) : null}
          {coords.map((coord, index) => (
            <circle
              className={styles.dot}
              cx={coord.x}
              cy={coord.y}
              key={`${coord.label}-${index}`}
              r={3}
            />
          ))}
        </svg>
      )}
      <table className={styles.table}>
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Point</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={`${point.label}-${index}`}>
              <th scope="row">{point.label}</th>
              <td>{point.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
