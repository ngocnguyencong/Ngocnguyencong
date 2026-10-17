// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_COOKIE_NAME, THEME_STORAGE_KEY } from "./catalog";
import { ThemeMenu } from "./theme-menu";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let view: HTMLDivElement;

function mount() {
  view = document.createElement("div");
  document.body.appendChild(view);
  root = createRoot(view);
  act(() => root.render(<ThemeMenu side="top" />));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
});
afterEach(() => {
  act(() => root?.unmount());
  view?.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("theme menu", () => {
  it("shows the current pack and applies a pick through the theme pipeline", () => {
    document.documentElement.dataset.theme = "obsidian";
    mount();
    const trigger = view.querySelector("summary")!;
    expect(trigger.textContent).toContain("Obsidian");
    expect(trigger.getAttribute("aria-label")).toContain("Obsidian");

    const details = view.querySelector("details")!;
    act(() => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });
    const paperOption = Array.from(view.querySelectorAll<HTMLButtonElement>("ul button")).find(
      (button) => button.textContent === "Paper",
    )!;
    act(() => paperOption.click());

    expect(document.documentElement.dataset.theme).toBe("paper");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("paper");
    expect(document.cookie).toContain(`${THEME_COOKIE_NAME}=paper`);
  });

  it("stays in sync when the pack changes elsewhere", async () => {
    mount();
    document.documentElement.dataset.theme = "glacier";
    await act(async () => {});
    const trigger = view.querySelector("summary")!;
    expect(trigger.textContent).toContain("Glacier");
  });
});
