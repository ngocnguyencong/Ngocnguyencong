"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import styles from "./master-detail.module.css";

export type MasterDetailItem = { key: string; title: string };

export type MasterDetailProps<T extends MasterDetailItem> = {
  items: readonly T[];
  selectedKey: string | null;
  onSelectionChange: (key: string | null) => void;
  renderListItem?: (item: T, selected: boolean) => ReactNode;
  renderDetail: (item: T) => ReactNode;
  listLabel: string;
  detailLabel: string;
  backLabel: string;
  empty?: ReactNode;
  loading?: boolean;
  loadingState?: ReactNode;
  error?: ReactNode;
};

export function MasterDetail<T extends MasterDetailItem>({
  items,
  selectedKey,
  onSelectionChange,
  renderListItem,
  renderDetail,
  listLabel,
  detailLabel,
  backLabel,
  empty,
  loading = false,
  loadingState,
  error,
}: MasterDetailProps<T>) {
  const selectedItem = items.find((item) => item.key === selectedKey);
  const hasError = error !== undefined && error !== null && error !== false;
  const state = hasError ? "error" : loading ? "loading" : selectedItem ? "detail" : "empty";
  const showDetailOnNarrow = Boolean(selectedItem) || loading || hasError || items.length === 0;
  const detailRef = useRef<HTMLElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const itemButtons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<
    { kind: "detail"; key: string } | { kind: "list"; key: string } | null
  >(null);

  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;

    if (target.kind === "detail" && selectedKey === target.key) {
      (backRef.current ?? detailRef.current)?.focus();
    } else if (target.kind === "list" && selectedKey === null) {
      itemButtons.current.get(target.key)?.focus();
    }
  }, [selectedKey]);

  function isNarrowView() {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 44rem)").matches
    );
  }

  function selectItem(key: string) {
    if (isNarrowView() && key !== selectedItem?.key) {
      pendingFocus.current = { kind: "detail", key };
    } else if (isNarrowView()) {
      backRef.current?.focus();
    }
    onSelectionChange(key);
  }

  function clearSelection() {
    if (selectedItem && isNarrowView()) {
      pendingFocus.current = { kind: "list", key: selectedItem.key };
    }
    onSelectionChange(null);
  }

  return (
    <div
      className={styles.root}
      data-selected={showDetailOnNarrow ? "true" : undefined}
      data-state={state}
    >
      <section aria-label={listLabel} className={styles.list}>
        <ul className={styles.items}>
          {items.map((item) => {
            const selected = item.key === selectedItem?.key;
            return (
              <li className={styles.item} key={item.key}>
                <button
                  aria-current={selected ? "true" : undefined}
                  className={styles.itemButton}
                  onClick={() => selectItem(item.key)}
                  ref={(node) => {
                    if (node) itemButtons.current.set(item.key, node);
                    else itemButtons.current.delete(item.key);
                  }}
                  type="button"
                >
                  <span className={styles.itemTitle}>{item.title}</span>
                  {renderListItem ? (
                    <span className={styles.itemContent}>{renderListItem(item, selected)}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-busy={loading || undefined}
        aria-label={detailLabel}
        className={styles.detail}
        data-state={state}
        ref={detailRef}
        tabIndex={-1}
      >
        {selectedItem ? (
          <button className={styles.back} onClick={clearSelection} ref={backRef} type="button">
            {backLabel}
          </button>
        ) : null}
        {hasError ? (
          <div className={styles.error} role="status">
            {error}
          </div>
        ) : loading ? (
          <div className={styles.loading} role="status">
            {loadingState ?? "Loading…"}
          </div>
        ) : selectedItem ? (
          <div className={styles.detailContent}>{renderDetail(selectedItem)}</div>
        ) : (
          <div className={styles.empty}>{empty ?? "Choose an item to see its details."}</div>
        )}
      </section>
    </div>
  );
}
