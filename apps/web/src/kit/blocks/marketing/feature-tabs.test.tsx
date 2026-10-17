// @vitest-environment jsdom

import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { FeatureTabs } from "./feature-tabs";

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

const ITEMS = [
  {
    description: "First panel copy.",
    id: "one",
    label: "First",
    points: ["Point A", "Point B"],
    title: "First headline",
  },
  {
    description: "Second panel copy.",
    id: "two",
    label: "Second",
    points: ["Point C"],
    title: "Second headline",
  },
  {
    description: "Third panel copy.",
    id: "three",
    label: "Third",
    points: ["Point D"],
    title: "Third headline",
  },
] as const;

describe("feature-tabs block", () => {
  it("renders every panel in the DOM so no-JS readers get all copy", () => {
    const html = renderToStaticMarkup(<FeatureTabs heading="Tour" items={ITEMS.slice(0, 2)} />);

    // All panels render — hiding is a CSS concern gated on scripting.
    expect((html.match(/role="tabpanel"/g) ?? []).length).toBe(2);
    expect(html).toContain("First headline");
    expect(html).toContain("Second headline");
    // Exactly one panel/tab pair is marked active on first render.
    expect((html.match(/data-active="true"/g) ?? []).length).toBe(2);
    // No `hidden` attribute — that would drop no-JS readers' content.
    expect(html).not.toContain(" hidden");
  });

  it("wires the WAI-ARIA tabs pattern: controls, labels, selected, roving tabindex", () => {
    const html = renderToStaticMarkup(<FeatureTabs heading="Tour" items={ITEMS.slice(0, 2)} />);

    expect(html).toContain('role="tablist"');
    expect((html.match(/role="tab"/g) ?? []).length).toBe(2);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
    // Tab → panel and panel → tab references resolve to real ids.
    const control = /aria-controls="([^"]+)"/.exec(html)?.[1];
    const labelledby = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(control).toBeTruthy();
    expect(labelledby).toBeTruthy();
    expect(html).toContain(`id="${control}"`);
    expect(html).toContain(`id="${labelledby}"`);
    // Roving tabindex: one tab stop across the strip; panels are focusable.
    expect((html.match(/tabindex="0"/g) ?? []).length).toBe(3);
    expect(html).toContain('tabindex="-1"');
  });

  it("honors defaultActiveId and falls back to ProductFrame media", () => {
    const html = renderToStaticMarkup(<FeatureTabs defaultActiveId="two" items={ITEMS} />);
    // The second item's tab and panel are the selected pair (order-agnostic).
    expect(
      /aria-selected="true"[^>]*id="[^"]*-tab-two"|id="[^"]*-tab-two"[^>]*aria-selected="true"/.test(
        html,
      ),
    ).toBe(true);
    expect(
      /data-active="true"[^>]*id="[^"]*-panel-two"|id="[^"]*-panel-two"[^>]*data-active="true"/.test(
        html,
      ),
    ).toBe(true);
    // No media supplied → the default framed placeholder renders.
    expect(html).toContain("mediaPlaceholder");
  });

  it("moves selection and focus together on Arrow/Home/End keys", () => {
    const view = mount(<FeatureTabs items={ITEMS} />);
    const tabs = () => Array.from(view.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panels = () => Array.from(view.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
    const press = (tab: HTMLButtonElement | undefined, key: string) => {
      act(() => {
        tab?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
      });
    };

    expect(tabs()[0]?.getAttribute("aria-selected")).toBe("true");
    expect(tabs()[0]?.tabIndex).toBe(0);
    expect(tabs()[1]?.tabIndex).toBe(-1);

    // ArrowRight activates the next tab and moves focus with it.
    press(tabs()[0], "ArrowRight");
    expect(tabs()[1]?.getAttribute("aria-selected")).toBe("true");
    expect(tabs()[1]?.tabIndex).toBe(0);
    expect(tabs()[0]?.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(tabs()[1]);
    expect(panels()[1]?.getAttribute("data-active")).toBe("true");
    expect(panels()[0]?.getAttribute("data-active")).toBeNull();

    // ArrowRight on the last tab wraps to the first.
    press(tabs()[2], "End");
    expect(document.activeElement).toBe(tabs()[2]);
    press(tabs()[2], "ArrowRight");
    expect(tabs()[0]?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs()[0]);

    // ArrowLeft on the first wraps to the last; Home returns to the first.
    press(tabs()[0], "ArrowLeft");
    expect(tabs()[2]?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs()[2]);
    press(tabs()[2], "Home");
    expect(tabs()[0]?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs()[0]);
  });

  it("recovers to the first item when items lose the selected id", () => {
    function Harness({
      items,
    }: {
      items: readonly {
        id: string;
        label: string;
        title: string;
        description: string;
        points: readonly string[];
      }[];
    }) {
      return <FeatureTabs defaultActiveId="two" items={items} />;
    }
    const view = mount(<Harness items={ITEMS} />);
    // Re-render with a set that lacks "two" — the first item must take over.
    act(() => root?.render(<Harness items={ITEMS.slice(0, 1)} />));
    const tab = view.querySelector<HTMLButtonElement>('[role="tab"]');
    const panel = view.querySelector<HTMLElement>('[role="tabpanel"]');
    expect(tab?.getAttribute("aria-selected")).toBe("true");
    expect(tab?.tabIndex).toBe(0);
    expect(panel?.getAttribute("data-active")).toBe("true");
  });
});
