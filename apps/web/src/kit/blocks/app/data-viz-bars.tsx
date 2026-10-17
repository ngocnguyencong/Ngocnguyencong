import styles from "./data-viz-bars.module.css";

export type BarDatum = {
  /** X-axis label — shown under the column + row header in the hidden table. */
  label: string;
  /** Numeric value; must be ≥ 0 (negatives clamp to the baseline). */
  value: number;
};

/** Round to 2 decimals so SSR output stays clean and stable. */
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Kit block — dependency-free vertical bar chart for period comparisons
 * (weekly signups, monthly revenue). Bars are real flex columns sized by
 * percentage height, so no chart library or SVG geometry is needed.
 *
 * Unlike chart-line the y-axis is a mandatory zero baseline — bar LENGTH is
 * the encoded value, so truncating the axis would lie. All-zero series render
 * an empty-state note instead of a flat ghost row. Screen readers get a
 * visually-hidden `<table>` with every datum; the visible labels and values
 * sit inside a `role="img"` region whose aria-label summarizes the series.
 */
export function DataVizBars({
  bars,
  label,
}: {
  /** Columns in x order. */
  bars: readonly BarDatum[];
  /** Chart name — visible caption, table caption, and aria-label prefix. */
  label: string;
}) {
  const max = Math.max(0, ...bars.map((bar) => bar.value));

  return (
    <figure className={styles.chart}>
      <figcaption className={styles.caption}>{label}</figcaption>
      {bars.length === 0 || max === 0 ? (
        <p className={styles.empty}>No data yet.</p>
      ) : (
        <div
          aria-label={`${label}: ${bars.length} bars, max ${round(max)}`}
          className={styles.plot}
          role="img"
        >
          {bars.map((bar, index) => (
            <div className={styles.col} key={`${bar.label}-${index}`}>
              <span className={styles.barValue}>{bar.value}</span>
              <div className={styles.barLane}>
                <div
                  className={styles.bar}
                  style={{ height: `${(Math.max(0, bar.value) / max) * 100}%` }}
                />
              </div>
              <span className={styles.barLabel}>{bar.label}</span>
            </div>
          ))}
        </div>
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
          {bars.map((bar, index) => (
            <tr key={`${bar.label}-${index}`}>
              <th scope="row">{bar.label}</th>
              <td>{bar.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
