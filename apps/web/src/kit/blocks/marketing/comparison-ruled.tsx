import { Check } from "lucide-react";

import styles from "./comparison-ruled.module.css";

export type ComparisonRow = {
  /** Dimension name — e.g. "Who it finds". */
  label: string;
  /** The incumbent / typical answer, rendered muted. */
  them: string;
  /** Your product's answer, rendered strong with an accent check. */
  us: string;
};

/**
 * Kit block — ruled comparison: a quiet three-column table drawn only with
 * hairlines (no card). The "us" column carries a small accent check; "them"
 * stays muted. Below 640px it collapses into stacked definition rows with
 * the column names repeated as muted labels.
 */
export function ComparisonRuled({
  columns,
  rows,
  eyebrow,
  title,
  sub,
}: {
  /** [dimension, them, us] column headers — dimension may be "". */
  columns: readonly [string, string, string];
  rows: readonly ComparisonRow[];
  eyebrow?: string | undefined;
  title: string;
  sub?: string | undefined;
}) {
  const [dimension, them, us] = columns;
  return (
    <section className={styles.section}>
      <div className={styles.wrap}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h2 className={styles.title}>{title}</h2>
        {sub ? <p className={styles.sub}>{sub}</p> : null}
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{dimension}</th>
              <th scope="col">{them}</th>
              <th scope="col">{us}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className={styles.dim}>{row.label}</td>
                <td className={styles.them} data-col={them}>
                  {row.them}
                </td>
                <td className={styles.us} data-col={us}>
                  <Check aria-hidden="true" className={styles.check} size={16} strokeWidth={2.4} />
                  {row.us}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
