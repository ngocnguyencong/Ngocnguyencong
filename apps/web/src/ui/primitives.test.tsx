// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog, Disclosure, Popover, Select, Tabs } from "./primitives";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(() => {
  void act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
function key(el: Element, value: string, shiftKey = false) {
  void act(() =>
    el.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, shiftKey })),
  );
}
function click(el: Element) {
  void act(() => (el as HTMLElement).click());
}

describe("Select", () => {
  it("scrolls the active option into view for End and arrow navigation", () => {
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    void act(() =>
      root.render(
        <Select label="Records">
          {Array.from({ length: 30 }, (_, index) => (
            <option key={index} value={index}>
              Record {index}
            </option>
          ))}
        </Select>,
      ),
    );
    const trigger = host.querySelector('[role="combobox"]')!;
    key(trigger, "End");
    expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });
  it("dismisses an open select before its enclosing overlay", () => {
    const outerEscape = vi.fn();
    void act(() =>
      root.render(
        <div onKeyDown={outerEscape}>
          <Select label="State">
            <option>A</option>
            <option>B</option>
          </Select>
        </div>,
      ),
    );
    const trigger = host.querySelector('[role="combobox"]')!;
    click(trigger);
    key(trigger, "Escape");
    expect(outerEscape).not.toHaveBeenCalled();
    key(trigger, "Escape");
    expect(outerEscape).toHaveBeenCalledTimes(1);
  });
  it("selects with keys, skips disabled options and submits the native value", () => {
    void act(() =>
      root.render(
        <form>
          <label htmlFor="plan">Plan</label>
          <Select id="plan" name="plan" defaultValue="one">
            <option value="one">One</option>
            <option disabled value="two">
              Two
            </option>
            <option value="three">Three</option>
          </Select>
        </form>,
      ),
    );
    const trigger = host.querySelector('[role="combobox"]')!;
    expect(trigger.getAttribute("aria-label")).toBe("Plan");
    key(trigger, "ArrowDown");
    key(trigger, "End");
    key(trigger, "Enter");
    expect(new FormData(host.querySelector("form")!).get("plan")).toBe("three");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    void act(() => host.querySelector("form")!.reset());
    expect(trigger.textContent).toContain("One");
  });
  it("restores focus on Escape without changing the selection", () => {
    void act(() =>
      root.render(
        <Select label="State" defaultValue="a">
          <option value="a">A</option>
          <option value="b">B</option>
        </Select>,
      ),
    );
    const trigger = host.querySelector('[role="combobox"]')!;
    click(trigger);
    key(trigger, "End");
    key(trigger, "Escape");
    expect(document.activeElement).toBe(trigger);
    expect(trigger.textContent).toContain("A");
  });
});
describe("Dialog", () => {
  it("excludes hidden controls and closed descendant dialogs from parent focus stops", () => {
    void act(() =>
      root.render(
        <Dialog open onOpenChange={() => {}} title="Parent">
          <button>Save</button>
          <button style={{ visibility: "hidden" }}>Invisible</button>
          <div style={{ display: "none" }}>
            <button>Hidden</button>
          </div>
          <fieldset disabled>
            <input aria-label="Disabled field" />
          </fieldset>
          <Dialog open={false} onOpenChange={() => {}} title="Child">
            <button>Child action</button>
          </Dialog>
        </Dialog>,
      ),
    );
    const first = host.querySelector<HTMLButtonElement>("dialog button")!;
    const last = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Save",
    )!;
    first.focus();
    key(first, "Tab", true);
    expect(document.activeElement).toBe(last);
    key(last, "Tab");
    expect(document.activeElement).toBe(first);
  });
  it("closes the inner modal without dismissing its parent", () => {
    function Nested() {
      const [outer, setOuter] = useState(true);
      const [inner, setInner] = useState(true);
      return (
        <Dialog open={outer} onOpenChange={setOuter} title="Outer">
          <Dialog open={inner} onOpenChange={setInner} title="Inner">
            <button>Apply</button>
          </Dialog>
        </Dialog>
      );
    }
    void act(() => root.render(<Nested />));
    const dialogs = host.querySelectorAll("dialog");
    key(dialogs[1]!, "Escape");
    expect(dialogs[1]!.open).toBe(false);
    expect(dialogs[0]!.open).toBe(true);
  });
  function Example() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <Dialog open={open} onOpenChange={setOpen} title="Edit" closeLabel="Close">
          <button>Save</button>
        </Dialog>
        <a href="#outside">Outside</a>
      </>
    );
  }
  it("contains Tab and restores the opener after Escape", () => {
    void act(() => root.render(<Example />));
    const opener = host.querySelector("button")!;
    opener.focus();
    click(opener);
    const dialog = host.querySelector("dialog")!;
    const buttons = dialog.querySelectorAll("button");
    const first = buttons[0]!;
    const last = buttons[buttons.length - 1]!;
    last.focus();
    key(last, "Tab");
    expect(document.activeElement).toBe(first);
    key(first, "Tab", true);
    expect(document.activeElement).toBe(last);
    void act(() => dialog.dispatchEvent(new Event("cancel", { cancelable: true })));
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
});
describe("Popover", () => {
  it("restores focus after a keyboard action closes its panel", () => {
    function Example() {
      const [open, setOpen] = useState(false);
      return (
        <Popover
          open={open}
          onOpenChange={setOpen}
          label="Actions"
          trigger={<button>Actions</button>}
        >
          <button onClick={() => setOpen(false)}>Apply</button>
        </Popover>
      );
    }
    void act(() => root.render(<Example />));
    const trigger = host.querySelector("button")!;
    click(trigger);
    const action = host.querySelector<HTMLButtonElement>('[role="dialog"] button')!;
    action.focus();
    click(action);
    expect(document.activeElement).toBe(trigger);
  });
  it("keeps a reopened popover mounted when an earlier exit would finish", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    function Example() {
      const [open, setOpen] = useState(false);
      return (
        <Popover
          open={open}
          onOpenChange={setOpen}
          label="Actions"
          trigger={<button>Actions</button>}
        >
          <button>Apply</button>
        </Popover>
      );
    }
    try {
      void act(() => root.render(<Example />));
      const trigger = host.querySelector("button")!;
      click(trigger);
      key(trigger, "Escape");
      click(trigger);
      void act(() => vi.advanceTimersByTime(150));
      expect(host.querySelector('[role="dialog"]')?.getAttribute("aria-hidden")).toBe("false");
    } finally {
      vi.useRealTimers();
    }
  });
  it("closes only the popover when Escape bubbles inside an outer overlay", () => {
    const outerEscape = vi.fn();
    function Example() {
      const [open, setOpen] = useState(false);
      return (
        <div onKeyDown={outerEscape}>
          <Popover
            open={open}
            onOpenChange={setOpen}
            label="Actions"
            trigger={<button>Actions</button>}
          >
            <button>Apply</button>
          </Popover>
        </div>
      );
    }
    void act(() => root.render(<Example />));
    const trigger = host.querySelector("button")!;
    click(trigger);
    key(trigger, "Escape");
    expect(outerEscape).not.toHaveBeenCalled();
  });
  it("dismisses outside and with Escape, returning keyboard focus", () => {
    function Example() {
      const [open, setOpen] = useState(false);
      return (
        <Popover
          open={open}
          onOpenChange={setOpen}
          label="Actions"
          trigger={<button>Actions</button>}
        >
          <button>Apply</button>
        </Popover>
      );
    }
    void act(() => root.render(<Example />));
    const trigger = host.querySelector("button")!;
    click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    key(host.querySelector('[role="dialog"]')!, "Escape");
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    click(trigger);
    void act(() => document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
describe("Tabs and Disclosure", () => {
  it("uses roving tab stops and selects the last tab with End", () => {
    void act(() =>
      root.render(
        <Tabs
          label="Preview"
          items={[
            { id: "one", label: "One", content: "First" },
            { id: "two", label: "Two", content: "Second" },
          ]}
        />,
      ),
    );
    const tabs = host.querySelectorAll('[role="tab"]');
    key(tabs[0]!, "End");
    expect(tabs[1]!.getAttribute("aria-selected")).toBe("true");
    expect(tabs[1]!.getAttribute("tabindex")).toBe("0");
    expect(host.querySelector('[role="tabpanel"]')!.textContent).toContain("Second");
  });
  it("keeps disclosure content in native details for no-JavaScript operation", () => {
    void act(() =>
      root.render(
        <Disclosure summary="Details" defaultOpen>
          Essential content
        </Disclosure>,
      ),
    );
    expect(host.querySelector("details")!.open).toBe(true);
    expect(host.querySelector("summary")!.textContent).toContain("Details");
    expect(host.textContent).toContain("Essential content");
  });
});
