// @vitest-environment jsdom

import { act, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Pagination } from "./pagination";

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

const paginationProps = {
  label: "Record pages",
  nextLabel: "Next page",
  noPagesLabel: "No pages",
  pageLabel: (page: number, pageCount: number) => `Page ${page} of ${pageCount}`,
  previousLabel: "Previous page",
};

describe("Pagination", () => {
  it("exposes named bounded actions and the controlled page status", () => {
    const html = renderToStaticMarkup(
      <Pagination
        {...paginationProps}
        currentPage={1}
        onPageChange={() => undefined}
        pageCount={3}
      />,
    );

    expect(html).toContain('aria-label="Record pages"');
    expect(html).toContain('aria-label="Previous page"');
    expect(html).toContain('aria-label="Next page"');
    expect(html).toContain("Page 1 of 3");
    expect(html).toMatch(/aria-label="Previous page"[^>]*disabled/);
    expect(html).not.toMatch(/aria-label="Next page"[^>]*disabled/);
  });

  it("reports adjacent pages through the controlled callback", () => {
    const onPageChange = vi.fn();

    function Harness() {
      const [page, setPage] = useState(2);
      return (
        <Pagination
          {...paginationProps}
          currentPage={page}
          onPageChange={(next) => {
            onPageChange(next);
            setPage(next);
          }}
          pageCount={3}
        />
      );
    }

    const view = mount(<Harness />);
    const next = view.querySelector<HTMLButtonElement>('button[aria-label="Next page"]');
    act(() => next?.click());
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    expect(view.textContent).toContain("Page 3 of 3");

    const previous = view.querySelector<HTMLButtonElement>('button[aria-label="Previous page"]');
    act(() => previous?.click());
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    expect(view.textContent).toContain("Page 2 of 3");
  });

  it("disables both actions when there are no pages and never requests an invalid page", () => {
    const onPageChange = vi.fn();
    const view = mount(
      <Pagination {...paginationProps} currentPage={0} onPageChange={onPageChange} pageCount={0} />,
    );

    const previous = view.querySelector<HTMLButtonElement>('button[aria-label="Previous page"]');
    const next = view.querySelector<HTMLButtonElement>('button[aria-label="Next page"]');
    expect(previous?.getAttribute("disabled")).not.toBeNull();
    expect(next?.getAttribute("disabled")).not.toBeNull();
    expect(view.textContent).toContain("No pages");
    act(() => {
      previous?.click();
      next?.click();
    });
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("disables next at the last page", () => {
    const html = renderToStaticMarkup(
      <Pagination
        {...paginationProps}
        currentPage={3}
        onPageChange={() => undefined}
        pageCount={3}
      />,
    );

    expect(html).toMatch(/aria-label="Next page"[^>]*disabled/);
    expect(html).not.toMatch(/aria-label="Previous page"[^>]*disabled/);
  });

  it("disables both actions and ignores clicks when disabled by the caller", () => {
    const onPageChange = vi.fn();
    const view = mount(
      <Pagination
        {...paginationProps}
        currentPage={2}
        disabled
        onPageChange={onPageChange}
        pageCount={3}
      />,
    );
    const previous = view.querySelector<HTMLButtonElement>('button[aria-label="Previous page"]');
    const next = view.querySelector<HTMLButtonElement>('button[aria-label="Next page"]');

    expect(previous?.disabled).toBe(true);
    expect(next?.disabled).toBe(true);
    act(() => {
      previous?.click();
      next?.click();
    });
    expect(onPageChange).not.toHaveBeenCalled();
  });
});
