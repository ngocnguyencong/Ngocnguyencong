// @vitest-environment jsdom

import { act, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MasterDetail, type MasterDetailItem } from "./master-detail";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

type RecordItem = MasterDetailItem & { summary: string };

const records: readonly RecordItem[] = [
  { key: "north", title: "North workspace", summary: "Review the next draft." },
  { key: "south", title: "South workspace", summary: "Prepare a short update." },
];

let container: HTMLDivElement | null = null;
let root: Root | null = null;
const matchMediaDescriptor = Object.getOwnPropertyDescriptor(window, "matchMedia");

function mockNarrowView(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches }) as MediaQueryList),
  });
}

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
  if (matchMediaDescriptor) {
    Object.defineProperty(window, "matchMedia", matchMediaDescriptor);
  } else {
    Reflect.deleteProperty(window, "matchMedia");
  }
});

describe("MasterDetail", () => {
  it("reports the stable key and renders the controlled detail", () => {
    mockNarrowView(true);
    const onSelectionChange = vi.fn();

    function Harness() {
      const [selectedKey, setSelectedKey] = useState<string | null>(null);
      return (
        <MasterDetail
          backLabel="Back"
          detailLabel="Workspace details"
          empty={<p>Select a workspace to see its details.</p>}
          items={records}
          listLabel="Workspaces"
          onSelectionChange={(key) => {
            onSelectionChange(key);
            setSelectedKey(key);
          }}
          renderDetail={(item) => <p>{item.summary}</p>}
          selectedKey={selectedKey}
        />
      );
    }

    const view = mount(<Harness />);
    const item = [...view.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("South workspace"),
    );
    expect(item).toBeDefined();
    item?.focus();

    act(() => item?.click());

    expect(onSelectionChange).toHaveBeenCalledWith("south");
    expect(view.textContent).toContain("Prepare a short update.");
    expect(item?.getAttribute("aria-current")).toBe("true");
    const back = [...view.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Back",
    );
    expect(document.activeElement).toBe(back);
  });

  it("renders the supplied empty, loading, and error states", () => {
    const props = {
      backLabel: "Back",
      detailLabel: "Workspace details",
      items: records,
      listLabel: "Workspaces",
      onSelectionChange: vi.fn(),
      renderDetail: (item: RecordItem) => <p>{item.summary}</p>,
      selectedKey: "north",
    };

    const empty = renderToStaticMarkup(
      <MasterDetail {...props} empty={<p>No workspace selected.</p>} selectedKey={null} />,
    );
    expect(empty).toContain("No workspace selected.");

    const loading = renderToStaticMarkup(
      <MasterDetail {...props} loading loadingState={<p>Loading workspaces</p>} />,
    );
    expect(loading).toContain('role="status"');
    expect(loading).toContain("Loading workspaces");
    expect(loading).not.toContain("Review the next draft.");

    const error = renderToStaticMarkup(
      <MasterDetail
        {...props}
        error={<p>Unable to load workspaces.</p>}
        loading
        loadingState={<p>Loading workspaces</p>}
      />,
    );
    expect(error).toContain("Unable to load workspaces.");
    expect(error).not.toContain("Loading workspaces");
  });

  it("shows the visible Back action and clears the controlled selection", () => {
    mockNarrowView(true);
    const onSelectionChange = vi.fn();

    function Harness() {
      const [selectedKey, setSelectedKey] = useState<string | null>("north");
      return (
        <MasterDetail
          backLabel="Back to workspaces"
          detailLabel="Workspace details"
          empty={<p>Select a workspace to see its details.</p>}
          items={records}
          listLabel="Workspaces"
          onSelectionChange={(key) => {
            onSelectionChange(key);
            setSelectedKey(key);
          }}
          renderDetail={(item) => <p>{item.summary}</p>}
          selectedKey={selectedKey}
        />
      );
    }

    const view = mount(<Harness />);
    const back = [...view.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Back to workspaces",
    );
    expect(back).toBeDefined();
    const selected = [...view.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("North workspace"),
    );
    back?.focus();

    act(() => back?.click());

    expect(onSelectionChange).toHaveBeenCalledWith(null);
    expect(view.textContent).toContain("Select a workspace to see its details.");
    expect(document.activeElement).toBe(selected);
  });

  it("preserves list-button focus when both panes remain visible", () => {
    mockNarrowView(false);
    const view = mount(
      <MasterDetail
        backLabel="Back"
        detailLabel="Workspace details"
        items={records}
        listLabel="Workspaces"
        onSelectionChange={() => undefined}
        renderDetail={(item) => <p>{item.summary}</p>}
        selectedKey={null}
      />,
    );
    const item = [...view.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("South workspace"),
    );
    item?.focus();

    act(() => item?.click());

    expect(document.activeElement).toBe(item);
  });

  it("uses the empty state when the controlled key no longer exists", () => {
    const html = renderToStaticMarkup(
      <MasterDetail
        backLabel="Back"
        detailLabel="Workspace details"
        empty={<p>Choose an available workspace.</p>}
        items={records}
        listLabel="Workspaces"
        onSelectionChange={() => undefined}
        renderDetail={(item) => <p>{item.summary}</p>}
        selectedKey="removed"
      />,
    );

    expect(html).toContain("Choose an available workspace.");
    expect(html).not.toContain("Review the next draft.");
    expect(html).not.toContain('data-selected="true"');
  });
});
