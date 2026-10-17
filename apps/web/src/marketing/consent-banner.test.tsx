// @vitest-environment jsdom
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CONSENT_STORAGE_KEY } from "./marketing-consent";
import { writeConsentChoice } from "./use-consent-choice";
import { ConsentBanner, ConsentPreferencesButton } from "./consent-banner";

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

function banner(view: HTMLElement): HTMLElement | null {
  return view.querySelector<HTMLElement>('[role="dialog"]');
}

function button(view: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(view.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label,
  );
  expect(found, `button "${label}"`).toBeTruthy();
  return found as HTMLButtonElement;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  writeConsentChoice(null);
  localStorage.clear();
});

describe("ConsentBanner", () => {
  it("stays hidden until a client pass and while capture is disabled", () => {
    const view = mount(<ConsentBanner clientCaptureEnabled={false} />);
    expect(banner(view)).toBeNull();
  });

  it("shows undecided visitors the dialog and stores a reject choice", () => {
    const view = mount(<ConsentBanner clientCaptureEnabled />);
    const dialog = banner(view);
    expect(dialog?.textContent).toContain("This site would like to measure visits.");

    act(() => button(view, "Reject").click());

    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBe("rejected");
    expect(banner(view)).toBeNull();
  });

  it("stores an accept choice and hides", () => {
    const view = mount(<ConsentBanner clientCaptureEnabled />);
    act(() => button(view, "Accept").click());

    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBe("accepted");
    expect(banner(view)).toBeNull();
  });

  it("stays hidden once a choice exists", () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, "accepted");
    const view = mount(<ConsentBanner clientCaptureEnabled />);
    expect(banner(view)).toBeNull();
  });

  it("localizes the banner copy", () => {
    const view = mount(<ConsentBanner clientCaptureEnabled locale="fr" />);
    const dialog = banner(view);
    expect(dialog?.textContent).toContain("Ce site souhaite mesurer les visites.");
    button(view, "Refuser");
    button(view, "Accepter");
  });
});

describe("ConsentPreferencesButton", () => {
  it("renders nothing while analytics capture is off", () => {
    const view = mount(
      <ConsentPreferencesButton clientCaptureEnabled={false} label="Analytics preferences" />,
    );
    expect(view.querySelector("button")).toBeNull();
  });

  it("clears the stored choice so the banner re-opens", () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, "accepted");
    const view = mount(
      <>
        <ConsentBanner clientCaptureEnabled />
        <ConsentPreferencesButton clientCaptureEnabled label="Analytics preferences" />
      </>,
    );
    expect(banner(view)).toBeNull();

    act(() => button(view, "Analytics preferences").click());

    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
    expect(banner(view)?.textContent).toContain("This site would like to measure visits.");
  });

  it("is a real keyboard-accessible button", () => {
    const view = mount(
      <ConsentPreferencesButton clientCaptureEnabled label="Analytics preferences" />,
    );
    const control = view.querySelector("button");
    expect(control?.tagName).toBe("BUTTON");
    expect(control?.getAttribute("type")).toBe("button");
  });
});
