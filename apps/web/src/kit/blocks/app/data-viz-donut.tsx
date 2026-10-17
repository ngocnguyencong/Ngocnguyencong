import styles from "./data-viz-donut.module.css";

export type DonutSlice = {
  /** Slice name — legend row + row header in the visually-hidden data table. */
  label: string;
  /**
   * Numeric share; fractions are computed against the sum of all slices.
   * Donuts can't draw negative arcs — negative values clamp to 0 everywhere
   * they are displayed (the hidden table keeps the raw value).
   */
  value: number;
};

const SIZE = 160;
const RADIUS = 60;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Visual gap between arcs, in viewBox units. */
const GAP = 2;
/** Swatch palette slots — colors cycle when more slices arrive. */
const PALETTE_SIZE = 6;

/** Round to 2 decimals so SSR output stays clean and stable. */
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Kit block — dependency-free donut chart for part-to-whole shares (plan mix,
 * channel split, spend breakdown). One stroked circle per slice; segments are
 * drawn with stroke-dasharray/dashoffset, no chart library.
 *
 * Designed for 3–6 slices: the token-derived palette has six slots and cycles
 * beyond that — aggregate long tails into an "Other" slice upstream. A zero-sum
 * series renders an empty-state note instead of a blank ring, but the
 * visually-hidden `<table>` renders either way — the slice data stays readable
 * even when it cannot be drawn. The svg carries a `role="img"` summary
 * (slice count + total).
 */
export function DataVizDonut({
  label,
  slices,
}: {
  /** Chart name — visible caption, table caption, and aria-label prefix. */
  label: string;
  /** Slices in display order, starting at 12 o'clock and running clockwise. */
  slices: readonly DonutSlice[];
}) {
  /** Negative values can't be drawn — clamp to 0 for every rendered surface. */
  const values = slices.map((slice) => Math.max(0, slice.value));
  const total = values.reduce((sum, value) => sum + value, 0);

  const table = (
    <table className={styles.table}>
      <caption>{label}</caption>
      <thead>
        <tr>
          <th scope="col">Slice</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        {slices.map((slice, index) => (
          <tr key={`${slice.label}-${index}`}>
            <th scope="row">{slice.label}</th>
            <td>{slice.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (total <= 0) {
    return (
      <figure className={styles.chart}>
        <figcaption className={styles.caption}>{label}</figcaption>
        <p className={styles.empty}>No data yet.</p>
        {table}
      </figure>
    );
  }

  let offset = 0;
  const segments = slices.map((slice, index) => {
    const value = values[index] ?? 0;
    const length = (value / total) * CIRCUMFERENCE;
    const segment = {
      dash: round(Math.max(0, length - (slices.length > 1 ? GAP : 0))),
      key: `${slice.label}-${index}`,
      offset: round(-offset),
      swatch: index % PALETTE_SIZE,
    };
    offset += length;
    return segment;
  });

  return (
    <figure className={styles.chart}>
      <figcaption className={styles.caption}>{label}</figcaption>
      <div className={styles.body}>
        <div className={styles.donutWrap}>
          <svg
            aria-label={`${label}: ${slices.length} slices, total ${round(total)}`}
            className={styles.svg}
            role="img"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
          >
            <circle className={styles.track} cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} />
            <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
              {segments.map((segment) => (
                <circle
                  className={styles.arc}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  data-swatch={segment.swatch}
                  key={segment.key}
                  r={RADIUS}
                  strokeDasharray={`${segment.dash} ${round(CIRCUMFERENCE - segment.dash)}`}
                  strokeDashoffset={segment.offset}
                />
              ))}
            </g>
          </svg>
          <div aria-hidden="true" className={styles.center}>
            <strong className={styles.total}>{round(total)}</strong>
            <span className={styles.totalLabel}>Total</span>
          </div>
        </div>
        <ul className={styles.legend} role="list">
          {slices.map((slice, index) => (
            <li className={styles.legendItem} key={`${slice.label}-${index}`}>
              <span
                aria-hidden="true"
                className={styles.swatch}
                data-swatch={index % PALETTE_SIZE}
              />
              <span className={styles.legendLabel}>{slice.label}</span>
              <span className={styles.legendValue}>
                {values[index] ?? 0} · {Math.round(((values[index] ?? 0) / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
      {table}
    </figure>
  );
}
