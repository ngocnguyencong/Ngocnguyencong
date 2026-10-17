"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { AppLocale } from "@supastack/i18n";

import { DataTable } from "../kit/blocks/app/data-table";
import { MasterDetail } from "../kit/blocks/app/master-detail";
import { Pagination } from "../kit/blocks/app/pagination";
import { TableToolbar } from "../kit/blocks/app/table-toolbar";
import { Dialog, Disclosure, Popover, Select, Sheet, Tabs } from "../ui/primitives";
import { previewCopy, type PreviewRecord, type PreviewStatus } from "./preview-copy";
import styles from "./foundation-preview.module.css";

type PreviewMode = "ready" | "loading" | "empty" | "error";
type PreviewTab = "records" | "master-detail";

const PAGE_SIZE = 4;

export function FoundationPreview({ locale = "en" }: { locale?: AppLocale }) {
  const copy = previewCopy(locale);
  const [records, setRecords] = useState<readonly PreviewRecord[]>(() => copy.records);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PreviewStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mode, setMode] = useState<PreviewMode>("ready");
  const [controlsDisabled, setControlsDisabled] = useState(false);
  const [tab, setTab] = useState<PreviewTab>("records");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetRecord, setSheetRecord] = useState<PreviewRecord | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    return records.filter((record) => {
      const matchesSearch =
        query.length === 0 ||
        [record.reference, record.title, record.category, record.summary]
          .join(" ")
          .toLocaleLowerCase(locale)
          .includes(query);
      return matchesSearch && (statusFilter === "all" || record.status === statusFilter);
    });
  }, [locale, records, search, statusFilter]);

  const visibleRecords = mode === "empty" ? [] : filteredRecords;
  const pageCount = Math.ceil(visibleRecords.length / PAGE_SIZE);
  const currentPage = pageCount > 0 ? Math.min(page, pageCount) : 0;
  const pageRecords =
    pageCount > 0
      ? visibleRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
      : [];
  const disabled = controlsDisabled || mode !== "ready";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPage(1);
    setSelectedKey(null);
  }

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
    setSelectedKey(null);
  }

  function updateStatus(value: string) {
    setStatusFilter(value as PreviewStatus | "all");
    setPage(1);
    setSelectedKey(null);
  }

  function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const sequence = records.length + 101;
    const record: PreviewRecord = {
      key: `record-${sequence}`,
      reference: `R-${sequence}`,
      title,
      category: copy.createdCategory,
      status: "open",
      summary: copy.createdSummary,
    };
    setRecords((current) => [record, ...current]);
    clearFilters();
    setSelectedKey(record.key);
    setPage(1);
    setTab("master-detail");
    setDialogOpen(false);
    setNewTitle("");
  }

  const statusName = (status: PreviewStatus) => copy.statuses[status];
  const recordDetails = (record: PreviewRecord) => (
    <article className={styles.recordDetail}>
      <h4>{record.title}</h4>
      <p>{record.summary}</p>
      <dl className={styles.recordFields}>
        <div>
          <dt>{copy.category}</dt>
          <dd>{record.category}</dd>
        </div>
        <div>
          <dt>{copy.status}</dt>
          <dd>{statusName(record.status)}</dd>
        </div>
      </dl>
      <button
        className={styles.actionButton}
        disabled={disabled}
        onClick={() => setSheetRecord(record)}
        type="button"
      >
        {copy.openDetailsSheet}
      </button>
    </article>
  );

  const tableContent =
    mode === "loading" ? (
      <p className={styles.stateMessage} data-state="loading" role="status">
        {copy.loadingMessage}
      </p>
    ) : mode === "error" ? (
      <p className={styles.stateMessage} data-state="error" role="status">
        {copy.errorMessage}
      </p>
    ) : pageRecords.length === 0 ? (
      <p className={styles.stateMessage} data-state="empty" role="status">
        {copy.emptyMessage}
      </p>
    ) : (
      <div className={styles.tableViewport}>
        <DataTable
          caption={copy.tableCaption}
          columns={[
            { key: "reference", label: copy.columnReference },
            { key: "title", label: copy.columnTitle },
            { key: "status", label: copy.columnStatus },
          ]}
          rows={pageRecords.map((record) => ({
            key: record.key,
            cells: {
              reference: record.reference,
              title: record.title,
              status: statusName(record.status),
            },
          }))}
        />
      </div>
    );

  const tabs = [
    {
      id: "records",
      label: copy.recordsTab,
      content: (
        <section aria-labelledby="foundation-records-heading" className={styles.panel}>
          <h3 id="foundation-records-heading">{copy.recordsHeading}</h3>
          <fieldset
            aria-busy={mode === "loading" || undefined}
            className={styles.tableControls}
            disabled={disabled}
          >
            <legend className={styles.srOnly}>{copy.tableControls}</legend>
            <TableToolbar
              clearFiltersDisabled={search.length === 0 && statusFilter === "all"}
              clearFiltersLabel={copy.clearFilters}
              countLabel={copy.resultCount}
              disabled={disabled}
              onClearFilters={clearFilters}
              onSearchChange={updateSearch}
              resultCount={mode === "ready" ? filteredRecords.length : 0}
              search={search}
              searchLabel={copy.searchLabel}
            >
              <div className={styles.filterLabel}>
                <span>{copy.statusFilter}</span>
                <Select
                  disabled={disabled}
                  label={copy.statusFilter}
                  onChange={(event) => updateStatus(event.currentTarget.value)}
                  value={statusFilter}
                >
                  <option value="all">{copy.allStatuses}</option>
                  <option value="open">{copy.statuses.open}</option>
                  <option value="in-progress">{copy.statuses["in-progress"]}</option>
                  <option value="complete">{copy.statuses.complete}</option>
                </Select>
              </div>
              <Popover
                label={copy.actions}
                onOpenChange={setPopoverOpen}
                open={popoverOpen}
                trigger={
                  <button className={styles.actionButton} type="button">
                    {copy.actions}
                  </button>
                }
              >
                <div className={styles.popoverActions}>
                  <button
                    className={styles.popoverAction}
                    onClick={() => {
                      clearFilters();
                      setPopoverOpen(false);
                    }}
                    type="button"
                  >
                    {copy.actionClearFilters}
                  </button>
                  <button
                    className={styles.popoverAction}
                    onClick={() => {
                      setPage(1);
                      setPopoverOpen(false);
                    }}
                    type="button"
                  >
                    {copy.actionFirstPage}
                  </button>
                </div>
              </Popover>
              <button
                className={styles.actionButton}
                onClick={() => setDialogOpen(true)}
                type="button"
              >
                {copy.addRecord}
              </button>
            </TableToolbar>
            {tableContent}
            <Pagination
              currentPage={currentPage}
              disabled={disabled}
              label={copy.pageLabel}
              nextLabel={copy.nextPage}
              noPagesLabel={copy.noPages}
              onPageChange={setPage}
              pageCount={pageCount}
              pageLabel={copy.pageStatus}
              previousLabel={copy.previousPage}
            />
          </fieldset>
        </section>
      ),
    },
    {
      id: "master-detail",
      label: copy.detailTab,
      content: (
        <section aria-labelledby="foundation-detail-heading" className={styles.panel}>
          <h3 id="foundation-detail-heading">{copy.detailHeading}</h3>
          <MasterDetail
            backLabel={copy.backToRecords}
            detailLabel={copy.detailHeading}
            empty={<p>{visibleRecords.length === 0 ? copy.detailEmptyList : copy.detailEmpty}</p>}
            error={mode === "error" ? <p>{copy.errorMessage}</p> : undefined}
            items={visibleRecords}
            listLabel={copy.recordsHeading}
            loading={mode === "loading"}
            loadingState={<p>{copy.loadingMessage}</p>}
            onSelectionChange={setSelectedKey}
            renderDetail={recordDetails}
            renderListItem={(record) => <span>{statusName(record.status)}</span>}
            selectedKey={selectedKey}
          />
        </section>
      ),
    },
  ] as const;

  return (
    <section aria-labelledby="foundation-preview-heading" className={styles.root}>
      <header className={styles.header}>
        <h3 id="foundation-preview-heading">{copy.heading}</h3>
        <p>{copy.description}</p>
      </header>

      <Disclosure summary={copy.statesDisclosure}>
        <fieldset className={styles.stateControls}>
          <legend>{copy.stateLegend}</legend>
          {(
            [
              ["ready", copy.stateReady],
              ["loading", copy.stateLoading],
              ["empty", copy.stateEmpty],
              ["error", copy.stateError],
            ] as const
          ).map(([value, label]) => (
            <label className={styles.choice} key={value}>
              <input
                checked={mode === value}
                name="foundation-preview-mode"
                onChange={() => setMode(value)}
                type="radio"
                value={value}
              />
              <span>{label}</span>
            </label>
          ))}
          <label className={styles.choice}>
            <input
              checked={controlsDisabled}
              onChange={(event) => setControlsDisabled(event.currentTarget.checked)}
              type="checkbox"
            />
            <span>{copy.disableControls}</span>
          </label>
          <button className={styles.actionButton} disabled type="button">
            {copy.disabledAction}
          </button>
        </fieldset>
      </Disclosure>

      <Tabs
        items={tabs}
        label={copy.tabsLabel}
        onValueChange={(value) => setTab(value as PreviewTab)}
        value={tab}
      />

      <Dialog
        closeLabel={copy.dialogClose}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        title={copy.dialogTitle}
      >
        <form className={styles.dialogForm} onSubmit={addRecord}>
          <p>{copy.dialogDescription}</p>
          <label className={styles.filterLabel}>
            <span>{copy.newRecordLabel}</span>
            <input
              autoFocus
              className={styles.textInput}
              onChange={(event) => setNewTitle(event.currentTarget.value)}
              required
              value={newTitle}
            />
          </label>
          <div className={styles.dialogActions}>
            <button
              className={styles.actionButton}
              onClick={() => setDialogOpen(false)}
              type="button"
            >
              {copy.dialogCancel}
            </button>
            <button className={styles.actionButton} type="submit">
              {copy.dialogSubmit}
            </button>
          </div>
        </form>
      </Dialog>

      <Sheet
        closeLabel={copy.closeSheet}
        onOpenChange={(open) => {
          if (!open) setSheetRecord(null);
        }}
        open={sheetRecord !== null}
        side="right"
        title={sheetRecord?.title ?? copy.sheetTitle}
      >
        {sheetRecord ? (
          <div className={styles.sheetContent}>
            <p>{sheetRecord.summary}</p>
            <dl className={styles.recordFields}>
              <div>
                <dt>{copy.category}</dt>
                <dd>{sheetRecord.category}</dd>
              </div>
              <div>
                <dt>{copy.status}</dt>
                <dd>{statusName(sheetRecord.status)}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </Sheet>
    </section>
  );
}
