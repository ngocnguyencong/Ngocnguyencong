// @vitest-environment jsdom

import { act, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OtpInput, sanitizeOtp } from "./otp-input";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Two layers: static-markup assertions (vitest resolves `*.module.css` to
 * empty objects, so hooks are `data-otp-slot`/`aria-hidden`/native attributes,
 * never class names) plus jsdom interaction tests for the controlled-value
 * pipeline — sanitize-on-change, `onComplete` timing, and the append-only
 * caret clamp.
 */
describe("OtpInput", () => {
  it("renders one real input with one-time-code semantics", () => {
    const html = renderToStaticMarkup(<OtpInput id="auth-otp" />);

    expect(html).toContain('id="auth-otp"');
    expect(html).toContain('type="text"');
    // React's SSR emitter keeps prop casing in static markup.
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('autoComplete="one-time-code"');
    expect(html).toContain('autoCapitalize="none"');
    expect(html).toContain('autoCorrect="off"');
    expect(html).toContain('spellCheck="false"');
    // No maxLength — it would truncate pasted "123-456" before sanitizeOtp
    // sees it; the sanitizer already slices to `length`.
    expect(html).not.toContain("maxLength");
    // Single hidden input — the digit boxes are spans, not inputs.
    expect(html.match(/<input/g) ?? []).toHaveLength(1);
  });

  it("renders six aria-hidden digit slots by default", () => {
    const html = renderToStaticMarkup(<OtpInput />);

    expect(html.match(/data-otp-slot/g) ?? []).toHaveLength(6);
    expect(html).toContain('aria-hidden="true"');
  });

  it("honors a custom length and passes `name` through for form serialization", () => {
    const html = renderToStaticMarkup(<OtpInput length={4} name="otp" />);

    expect(html.match(/data-otp-slot/g) ?? []).toHaveLength(4);
    expect(html).toContain('name="otp"');
  });

  it("fills one slot per digit of a controlled value, in order", () => {
    const html = renderToStaticMarkup(<OtpInput value="483" />);

    expect(html.match(/data-otp-slot/g) ?? []).toHaveLength(6);
    const first = html.indexOf(">4<");
    const second = html.indexOf(">8<");
    const third = html.indexOf(">3<");
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
    expect(html).toContain('value="483"');
  });

  it("sanitizes a messy controlled value before rendering slots", () => {
    const html = renderToStaticMarkup(<OtpInput value="483-902" />);

    expect(html.match(/data-otp-slot/g) ?? []).toHaveLength(6);
    expect(html.indexOf(">4<")).toBeGreaterThan(-1);
    expect(html.indexOf(">2<")).toBeGreaterThan(-1);
    expect(html).toContain('value="483902"');
  });

  it("renders a mid-dash separator only for even lengths >= 4", () => {
    const slots = (length?: number) =>
      renderToStaticMarkup(<OtpInput length={length} />).match(/data-otp-separator/g) ?? [];

    expect(slots(6)).toHaveLength(1);
    expect(slots(4)).toHaveLength(1);
    expect(slots(5)).toHaveLength(0);
    expect(slots(2)).toHaveLength(0);
  });

  it("maps label to aria-label for standalone use", () => {
    const html = renderToStaticMarkup(<OtpInput label="One-time code" />);

    expect(html).toContain('aria-label="One-time code"');
  });
});

describe("sanitizeOtp", () => {
  it("strips separators and spaces from pasted codes", () => {
    expect(sanitizeOtp("123-456", 6)).toBe("123456");
    expect(sanitizeOtp("12 34 56", 6)).toBe("123456");
    expect(sanitizeOtp("abc123", 6)).toBe("123");
  });

  it("truncates to length", () => {
    expect(sanitizeOtp("1234567890", 6)).toBe("123456");
    expect(sanitizeOtp("999", 2)).toBe("99");
  });
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(element: ReactElement): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(element);
  });
  return container;
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
});

function inputOf(view: HTMLElement): HTMLInputElement {
  const input = view.querySelector("input");
  if (!(input instanceof HTMLInputElement)) throw new Error("hidden input not found");
  return input;
}

// React tracks input.value on the element instance — writing through the
// prototype setter is what makes the dispatched `input` event look like a
// real edit to the onChange detector. (`set` is re-typed as a `this`-bound
// property so the unbound reference honestly needs `.call(input, …)`.)
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

/** Stateful controlled harness — the component is controlled in real usage. */
function Harness({
  onChange,
  onComplete,
}: {
  onChange?: ((value: string) => void) | undefined;
  onComplete?: ((value: string) => void) | undefined;
}) {
  const [value, setValue] = useState("");
  return (
    <OtpInput
      label="One-time code"
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      onComplete={onComplete}
      value={value}
    />
  );
}

describe("OtpInput DOM behavior", () => {
  it("sanitizes a pasted value before onChange and clamps the caret to the end", () => {
    const onChange = vi.fn();
    const input = inputOf(mount(<Harness onChange={onChange} />));

    type(input, "483-902");

    expect(onChange).toHaveBeenLastCalledWith("483902");
    expect(input.value).toBe("483902");
    expect(input.selectionStart).toBe(input.value.length);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it("fires onComplete exactly once when the sixth digit lands, not on the fifth", () => {
    const onComplete = vi.fn();
    const input = inputOf(mount(<Harness onComplete={onComplete} />));

    for (const digits of ["1", "12", "123", "1234", "12345"]) {
      type(input, digits);
    }
    expect(onComplete).not.toHaveBeenCalled();

    type(input, "123456");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenLastCalledWith("123456");
  });

  it("clamps a mid-string caret back to the end on click, focus, and select", () => {
    const input = inputOf(mount(<Harness />));
    type(input, "12345");

    act(() => {
      input.setSelectionRange(1, 1);
    });
    act(() => {
      input.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(input.selectionStart).toBe(5);
    expect(input.selectionEnd).toBe(5);

    // jsdom fires focus/focusin from el.focus() — React's onFocus clamps.
    act(() => {
      input.setSelectionRange(0, 0);
    });
    act(() => {
      input.focus();
    });
    expect(input.selectionStart).toBe(5);
    expect(input.selectionEnd).toBe(5);

    // Arrow-key selection while focused: a raw `select` dispatch does not
    // reach React's onSelect in jsdom — the document-level `selectionchange`
    // (what browsers actually fire on caret moves) does.
    act(() => {
      input.setSelectionRange(0, 0);
    });
    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });
    expect(input.selectionStart).toBe(5);
    expect(input.selectionEnd).toBe(5);
  });

  it("refires onComplete on the completing edit of a full code only", () => {
    const onComplete = vi.fn();
    const input = inputOf(mount(<Harness onComplete={onComplete} />));

    type(input, "123456");
    expect(onComplete).toHaveBeenCalledTimes(1);

    // Editing below full length must not refire.
    type(input, "12345");
    expect(onComplete).toHaveBeenCalledTimes(1);

    // Documented re-fire: an edit that leaves a complete code fires again.
    type(input, "123457");
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenLastCalledWith("123457");
  });
});
