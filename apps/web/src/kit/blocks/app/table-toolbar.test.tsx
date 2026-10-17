// @vitest-environment jsdom

import { act, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TableToolbar } from "./table-toolbar";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(element: ReactElement): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(element));
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

const nativeValueSetter = (
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value") as
    { set?: (this: HTMLInputElement, value: string) => void } | undefined
)?.set;

function type(input: HTMLInputElement, value: string) {
  act(() => {
    nativeValueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("TableToolbar", () => {
  it("renders a visible search label, controlled value, count, and caller controls", () => {
    const html = renderToStaticMarkup(
      <TableToolbar
        clearFiltersLabel="Clear filters"
        countLabel={(count) => `${count} matching records`}
        onClearFilters={() => undefined}
        onSearchChange={() => undefined}
        resultCount={3}
        search="draft"
        searchLabel="Search records"
      >
        <label>
          Status
          <select aria-label="Status">
            <option>Any status</option>
          </select>
        </label>
        <button type="button">Export visible records</button>
      </TableToolbar>,
    );

    expect(html).toContain("Search records");
    expect(html).toContain('type="search"');
    expect(html).toContain('value="draft"');
    expect(html).toContain("3 matching records");
    expect(html).toContain("Any status");
    expect(html).toContain("Export visible records");
    expect(html).toContain("Clear filters");
  });

  it("reports edits and clear actions through the controlled callbacks", () => {
    const onSearchChange = vi.fn();
    const onClearFilters = vi.fn();

    function Harness() {
      const [search, setSearch] = useState("draft");
      return (
        <TableToolbar
          clearFiltersLabel="Clear filters"
          countLabel={(count) => `${count} matching records`}
          onClearFilters={() => {
            onClearFilters();
            setSearch("");
          }}
          onSearchChange={(value) => {
            onSearchChange(value);
            setSearch(value);
          }}
          resultCount={3}
          search={search}
          searchLabel="Search records"
        />
      );
    }

    const view = mount(<Harness />);
    const input = view.querySelector("input[type=search]");
    expect(input).toBeInstanceOf(HTMLInputElement);
    if (!(input instanceof HTMLInputElement)) return;

    type(input, "notes");
    expect(onSearchChange).toHaveBeenLastCalledWith("notes");
    expect(input.value).toBe("notes");

    const clear = [...view.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Clear filters",
    );
    act(() => clear?.click());
    expect(onClearFilters).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("");
  });

  it("keeps a disabled clear action native and renders arbitrary children", () => {
    const onClearFilters = vi.fn();
    const view = mount(
      <TableToolbar
        clearFiltersDisabled
        clearFiltersLabel="Clear filters"
        countLabel={(count) => `${count} matching records`}
        onClearFilters={onClearFilters}
        onSearchChange={() => undefined}
        resultCount={0}
        search=""
        searchLabel="Search records"
      >
        <button type="button">Open settings</button>
      </TableToolbar>,
    );

    const clear = [...view.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Clear filters",
    );
    expect(clear?.disabled).toBe(true);
    expect(view.textContent).toContain("Open settings");
    act(() => clear?.click());
    expect(onClearFilters).not.toHaveBeenCalled();
  });

  it("disables its built-in search and clear actions", () => {
    const onClearFilters = vi.fn();
    const view = mount(
      <TableToolbar
        clearFiltersLabel="Clear filters"
        countLabel={(count) => `${count} matching records`}
        disabled
        onClearFilters={onClearFilters}
        onSearchChange={() => undefined}
        resultCount={2}
        search="draft"
        searchLabel="Search records"
      />,
    );
    const input = view.querySelector<HTMLInputElement>('input[type="search"]');
    const clear = [...view.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Clear filters",
    );

    expect(input?.disabled).toBe(true);
    expect(clear?.disabled).toBe(true);
    act(() => clear?.click());
    expect(onClearFilters).not.toHaveBeenCalled();
  });
});
