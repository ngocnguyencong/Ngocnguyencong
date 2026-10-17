"use client";

import { useId, type ReactNode } from "react";

import styles from "./table-toolbar.module.css";

export type TableToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchLabel: string;
  resultCount: number;
  countLabel: (count: number) => ReactNode;
  clearFiltersLabel: string;
  onClearFilters: () => void;
  clearFiltersDisabled?: boolean;
  disabled?: boolean;
  children?: ReactNode;
};

export function TableToolbar({
  search,
  onSearchChange,
  searchLabel,
  resultCount,
  countLabel,
  clearFiltersLabel,
  onClearFilters,
  clearFiltersDisabled = false,
  disabled = false,
  children,
}: TableToolbarProps) {
  const searchId = useId();

  return (
    <div className={styles.root}>
      <label className={styles.search} htmlFor={searchId}>
        <span className={styles.searchLabel}>{searchLabel}</span>
        <input
          className={styles.searchInput}
          id={searchId}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          disabled={disabled}
          type="search"
          value={search}
        />
      </label>
      {children ? <div className={styles.controls}>{children}</div> : null}
      <div className={styles.actions}>
        <span className={styles.count} role="status">
          {countLabel(resultCount)}
        </span>
        <button
          className={styles.clear}
          disabled={disabled || clearFiltersDisabled}
          onClick={onClearFilters}
          type="button"
        >
          {clearFiltersLabel}
        </button>
      </div>
    </div>
  );
}
