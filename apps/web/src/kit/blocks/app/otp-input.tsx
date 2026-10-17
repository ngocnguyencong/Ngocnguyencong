"use client";

import { Fragment, useState, type Ref } from "react";

import styles from "./otp-input.module.css";

/**
 * Strips everything that is not a digit and truncates to `length` —
 * pasted "123-456" or "12 34 56" cleans into "123456".
 */
export function sanitizeOtp(value: string, length: number): string {
  return value.replace(/\D/g, "").slice(0, length);
}

function cx(...names: (string | false | undefined)[]): string | undefined {
  const joined = names.filter(Boolean).join(" ");
  return joined === "" ? undefined : joined;
}

/**
 * Append-only caret: the invisible input's text is ~53px while the slots span
 * ~276px (length 6), so a mid-row click lands `selectionStart` semi-arbitrarily and a
 * mid-string insert would shift digits (and could auto-submit a corrupted
 * complete code). Every interaction clamps the selection back to the end.
 * The inequality guard prevents selectionchange → setSelectionRange loops.
 */
function clampCaret(el: HTMLInputElement, position: number) {
  if (el.selectionStart !== position || el.selectionEnd !== position) {
    el.setSelectionRange(position, position);
  }
}

/**
 * Kit block — one-time-code field on the single-hidden-input pattern: one real
 * <input> sits invisible over a row of per-digit boxes, so native paste, iOS
 * SMS autofill (`autoComplete="one-time-code"`), selection, and screen readers
 * keep working while the slots stay pure visuals (`aria-hidden`). The field is
 * append-only — the caret always snaps to the end. Controlled via
 * `value`/`onChange`, or uncontrolled when `value` is omitted; `onComplete`
 * fires when the last digit lands (and again on edits to a full code). `name`
 * enables native form serialization; `ref` forwards to the real <input>.
 */
export function OtpInput({
  autoComplete = "one-time-code",
  autoFocus,
  disabled,
  id,
  label,
  length = 6,
  name,
  onChange,
  onComplete,
  ref,
  value,
}: {
  autoComplete?: string | undefined;
  autoFocus?: boolean | undefined;
  disabled?: boolean | undefined;
  /** For an external `<label htmlFor>`; otherwise pass `label`. */
  id?: string | undefined;
  /** Standalone `aria-label` when no external label element exists. */
  label?: string | undefined;
  /** Number of digit boxes — an even value >= 4 gets a dash mid-way. */
  length?: number | undefined;
  /** Form field name — enables native form serialization. */
  name?: string | undefined;
  onChange?: ((value: string) => void) | undefined;
  onComplete?: ((value: string) => void) | undefined;
  /** Forwarded to the real <input> (React 19 — no forwardRef needed). */
  ref?: Ref<HTMLInputElement> | undefined;
  value?: string | undefined;
}) {
  const [internal, setInternal] = useState("");
  const [focused, setFocused] = useState(false);

  // Sanitize the display value too — a parent passing "123-456" renders clean.
  const current = sanitizeOtp(value ?? internal, length);
  // A `value` without `onChange` is an intentional display — keep the input
  // readOnly so React stays quiet and the field is honestly non-editable.
  const readOnly = value !== undefined && onChange === undefined;
  const activeIndex = Math.min(current.length, length - 1);
  const showSeparator = length >= 4 && length % 2 === 0;

  function handleChange(el: HTMLInputElement) {
    const next = sanitizeOtp(el.value, length);
    // The caret ends wherever the edit left it — snap to the post-sanitize
    // end (the trailing select event does NOT fire on React's value write).
    clampCaret(el, next.length);
    if (next === current) return;
    if (value === undefined) setInternal(next);
    onChange?.(next);
    // Fires when the last digit lands — and again when an already-complete
    // code is edited, since `next !== current` is guaranteed above.
    if (next.length === length) onComplete?.(next);
  }

  return (
    <div className={styles.root} data-disabled={disabled || undefined}>
      <div aria-hidden="true" className={styles.slots}>
        {Array.from({ length }, (_, index) => {
          const digit = current[index] ?? "";
          const active = focused && index === activeIndex;
          return (
            <Fragment key={index}>
              {showSeparator && index === length / 2 ? (
                <span className={styles.separator} data-otp-separator="" />
              ) : null}
              <span
                className={cx(
                  styles.slot,
                  digit !== "" && styles.slotFilled,
                  active && styles.slotActive,
                )}
                data-otp-slot=""
              >
                {digit}
                {active && digit === "" ? <span className={styles.caret} /> : null}
              </span>
            </Fragment>
          );
        })}
      </div>
      {/* Rendered last so it paints over the slots and receives every click —
          the browser focuses it natively, then the caret clamps to the end. */}
      <input
        aria-label={label}
        autoCapitalize="none"
        autoComplete={autoComplete}
        autoCorrect="off"
        autoFocus={autoFocus}
        className={styles.input}
        disabled={disabled}
        id={id}
        inputMode="numeric"
        name={name}
        onBlur={() => setFocused(false)}
        onChange={(event) => handleChange(event.currentTarget)}
        onClick={(event) => {
          const el = event.currentTarget;
          // Derive the clamp target from the element's sanitized value — a
          // between-commit event can fire before `current` catches up.
          clampCaret(el, sanitizeOtp(el.value, length).length);
        }}
        onFocus={(event) => {
          const el = event.currentTarget;
          setFocused(true);
          clampCaret(el, sanitizeOtp(el.value, length).length);
        }}
        onSelect={(event) => {
          const el = event.currentTarget;
          clampCaret(el, sanitizeOtp(el.value, length).length);
        }}
        readOnly={readOnly}
        ref={ref}
        spellCheck={false}
        type="text"
        value={current}
      />
    </div>
  );
}
