"use client";

import type { ReactNode } from "react";

import styles from "./pagination.module.css";

export type PaginationProps = {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label: string;
  previousLabel: string;
  nextLabel: string;
  pageLabel: (page: number, pageCount: number) => ReactNode;
  noPagesLabel: string;
  disabled?: boolean;
};

export function Pagination({
  currentPage,
  pageCount,
  onPageChange,
  label,
  previousLabel,
  nextLabel,
  pageLabel,
  noPagesLabel,
  disabled = false,
}: PaginationProps) {
  const pages = Number.isFinite(pageCount) ? Math.max(0, Math.floor(pageCount)) : 0;
  const page =
    pages > 0 && Number.isFinite(currentPage)
      ? Math.min(pages, Math.max(1, Math.floor(currentPage)))
      : 0;
  const canGoPrevious = page > 1;
  const canGoNext = page > 0 && page < pages;

  return (
    <nav aria-label={label} className={styles.root}>
      <button
        aria-label={previousLabel}
        className={styles.action}
        disabled={disabled || !canGoPrevious}
        onClick={() => {
          if (!disabled && canGoPrevious) onPageChange(page - 1);
        }}
        type="button"
      >
        {previousLabel}
      </button>
      <span className={styles.status} role="status">
        {pages > 0 ? pageLabel(page, pages) : noPagesLabel}
      </span>
      <button
        aria-label={nextLabel}
        className={styles.action}
        disabled={disabled || !canGoNext}
        onClick={() => {
          if (!disabled && canGoNext) onPageChange(page + 1);
        }}
        type="button"
      >
        {nextLabel}
      </button>
    </nav>
  );
}
