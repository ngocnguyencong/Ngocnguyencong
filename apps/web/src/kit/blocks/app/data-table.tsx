import type { ReactNode } from "react";

import styles from "./data-table.module.css";

export type DataTableColumn = {
  key: string;
  label: string;
  /** Renders end-aligned for numbers/amounts. */
  align?: "start" | "end" | undefined;
};

export type DataTableRow = {
  key: string;
  cells: Readonly<Record<string, ReactNode>>;
};

/**
 * Kit block — plain accessible data table for orders, entries, and records.
 * Cells are ReactNodes so callers can place badges, links, or row actions.
 */
export function DataTable({
  caption,
  columns,
  rows,
  emptyMessage = "No records yet.",
}: {
  caption?: string | undefined;
  columns: readonly DataTableColumn[];
  rows: readonly DataTableRow[];
  emptyMessage?: string | undefined;
}) {
  if (rows.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }
  return (
    <div className={styles.scroll} role="region" aria-label={caption} tabIndex={0}>
      <table className={styles.table}>
        {caption ? <caption className={styles.caption}>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                className={column.align === "end" ? styles.end : undefined}
                key={column.key}
                scope="col"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {columns.map((column) => (
                <td className={column.align === "end" ? styles.end : undefined} key={column.key}>
                  {row.cells[column.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
