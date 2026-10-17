"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { motionTokens } from "@supastack/design-tokens";
import styles from "./primitives.module.css";

export function reducedMotion() {
  return typeof matchMedia !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Keep an exiting surface mounted; reopening cancels the pending removal. */
export function usePresence(open: boolean, duration = motionTokens.exit) {
  const [present, setPresent] = useState(open);
  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    if (reducedMotion()) {
      setPresent(false);
      return;
    }
    const timer = setTimeout(() => setPresent(false), duration);
    return () => clearTimeout(timer);
  }, [open, duration]);
  return present || open;
}

type OverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
};

let scrollLocks = 0;
let previousOverflow = "";

function dialogFocusStops(dialog: HTMLDialogElement): HTMLElement[] {
  return [
    ...dialog.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,[tabindex="0"]'),
  ].filter((element) => {
    if (
      element.closest("dialog") !== dialog ||
      element.matches(":disabled") ||
      element.closest('[hidden],[inert],[aria-hidden="true"]') ||
      element.tabIndex < 0
    )
      return false;
    if (
      typeof element.checkVisibility === "function" &&
      !element.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })
    )
      return false;
    for (
      let current: HTMLElement | null = element;
      current && current !== dialog;
      current = current.parentElement
    ) {
      const style = getComputedStyle(current);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse" ||
        style.contentVisibility === "hidden"
      )
        return false;
    }
    return true;
  });
}

export function Dialog({
  open,
  onOpenChange,
  title,
  closeLabel = "Close",
  children,
  className,
  side,
}: OverlayProps & { side?: "left" | "right" | undefined }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const animationRef = useRef<Animation | null>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    if (scrollLocks++ === 0) {
      previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
    }
    return () => {
      if (--scrollLocks === 0) document.documentElement.style.overflow = previousOverflow;
    };
  }, [open]);
  useEffect(() => {
    const node = dialogRef.current;
    const panel = panelRef.current;
    if (!node || !panel) return;
    animationRef.current?.cancel();
    const animate = (enter: boolean) => {
      if (reducedMotion() || typeof panel.animate !== "function") return null;
      const shifted = side ? `translateX(${side === "left" ? "-" : ""}12px)` : "translateY(6px)";
      return panel.animate(
        enter
          ? [
              { opacity: 0, transform: shifted },
              { opacity: 1, transform: "none" },
            ]
          : [
              { opacity: 1, transform: "none" },
              { opacity: 0, transform: shifted },
            ],
        {
          duration: enter ? motionTokens.enter : motionTokens.exit,
          easing: "cubic-bezier(0.16,1,0.3,1)",
          fill: "both",
        },
      );
    };
    if (open) {
      if (!node.open) {
        openerRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        node.showModal();
        const stops = dialogFocusStops(node);
        (
          stops.find((element) => element.hasAttribute("autofocus")) ??
          stops.find((element) => element.matches("input")) ??
          stops[0] ??
          node
        ).focus();
      }
      animationRef.current = animate(true);
    } else if (node.open) {
      const finish = () => {
        node.close();
        if (openerRef.current?.isConnected) openerRef.current.focus();
      };
      const animation = animate(false);
      animationRef.current = animation;
      if (animation) animation.onfinish = finish;
      else finish();
    }
    return () => {
      animationRef.current?.cancel();
    };
  }, [open, side]);
  useEffect(
    () => () => {
      if (openerRef.current?.isConnected) openerRef.current.focus();
    },
    [],
  );
  return (
    <dialog
      ref={dialogRef}
      className={`${styles.dialog} ${side ? styles.sheet : ""} ${className ?? ""}`}
      data-side={side}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpenChange(false);
      }}
      onClose={(event) => {
        event.stopPropagation();
        if (open) onOpenChange(false);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onOpenChange(false);
        }
        if (event.key !== "Tab") return;
        const stops = dialogFocusStops(event.currentTarget);
        const first = stops[0],
          last = stops[stops.length - 1];
        if (!first) {
          event.preventDefault();
          event.currentTarget.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      tabIndex={-1}
    >
      <div className={styles.dialogPanel} ref={panelRef}>
        <header className={styles.dialogHeader}>
          <h2 id={titleId}>{title}</h2>
          <button
            className={styles.iconButton}
            type="button"
            aria-label={closeLabel}
            onClick={() => onOpenChange(false)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function Sheet(props: OverlayProps & { side?: "left" | "right" | undefined }) {
  return <Dialog {...props} side={props.side ?? "right"} />;
}

export function Popover({
  open,
  onOpenChange,
  trigger,
  label,
  children,
  className,
  placement = "bottom",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  label: string;
  children: ReactNode;
  className?: string | undefined;
  placement?: "bottom" | "top" | undefined;
}) {
  const container = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const focusWasInPanel = useRef(false);
  useLayoutEffect(() => {
    if (!open && focusWasInPanel.current) {
      focusWasInPanel.current = false;
      container.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }, [open]);
  const id = useId();
  const present = usePresence(open);
  const [position, setPosition] = useState<{ top: number; left: number }>();
  useEffect(() => {
    if (!open) return;
    function close(event: Event) {
      if (!container.current?.contains(event.target as Node)) {
        focusWasInPanel.current = false;
        onOpenChange(false);
      }
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
        container.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    }
    function place() {
      const rect = container.current?.getBoundingClientRect();
      const height = panel.current?.offsetHeight ?? 0;
      const width = panel.current?.offsetWidth ?? 280;
      if (!rect) return;
      const below = rect.bottom + 6;
      const top =
        placement === "top" || below + height > innerHeight
          ? Math.max(8, rect.top - height - 6)
          : below;
      setPosition({ top, left: Math.max(8, Math.min(rect.left, innerWidth - width - 8)) });
    }
    place();
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, placement, onOpenChange]);
  const button = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<ComponentProps<"button">>, {
        "aria-expanded": open,
        "aria-controls": id,
        "aria-haspopup": "dialog",
        onClick: (event) => {
          (trigger.props as ComponentProps<"button">).onClick?.(event);
          if (!event.defaultPrevented) onOpenChange(!open);
        },
      })
    : trigger;
  return (
    <div
      className={styles.popoverAnchor}
      ref={container}
      onFocusCapture={(event) => {
        focusWasInPanel.current = panel.current?.contains(event.target) ?? false;
      }}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onOpenChange(false);
          container.current?.querySelector<HTMLButtonElement>("button")?.focus();
        }
      }}
    >
      {button}
      {present ? (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={label}
          aria-hidden={!open}
          inert={!open}
          data-state={open ? "open" : "closed"}
          className={`${styles.popover} ${className ?? ""}`}
          style={position}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

type SelectOption = { value: string; label: string; disabled: boolean };
export function Select({
  children,
  label,
  value,
  defaultValue,
  onChange,
  onFocus,
  onInvalid,
  className,
  ref: forwardedRef,
  ...props
}: ComponentProps<"select"> & { label?: string | undefined }) {
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const id = useId();
  const [enhanced, setEnhanced] = useState(false);
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [selected, setSelected] = useState(String(value ?? defaultValue ?? ""));
  const [accessibleLabel, setAccessibleLabel] = useState(label ?? props["aria-label"] ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const present = usePresence(open);
  useEffect(() => {
    const node = native.current;
    if (!node) return;
    setOptions(
      [...node.options].map((option) => ({
        value: option.value,
        label: option.label,
        disabled:
          option.disabled ||
          (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled),
      })),
    );
    setSelected(node.value);
    setAccessibleLabel(
      label ??
        props["aria-label"] ??
        [...(node.labels ?? [])]
          .map((el) => el.textContent)
          .join(" ")
          .trim(),
    );
    setEnhanced(true);
    function reset() {
      setSelected(
        String(
          defaultValue ??
            [...node!.options].find((option) => option.defaultSelected)?.value ??
            node!.options[0]?.value ??
            "",
        ),
      );
      setOpen(false);
    }
    node.form?.addEventListener("reset", reset);
    return () => node.form?.removeEventListener("reset", reset);
  }, [children, defaultValue, label, props["aria-label"], value]);
  useEffect(() => {
    if (!open) return;
    function close(event: Event) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const option = document.getElementById(`${id}-${active}`);
    if (typeof option?.scrollIntoView === "function") option.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);
  const displayValue = value === undefined ? selected : String(value);
  const enabled = options
    .map((option, index) => (option.disabled ? -1 : index))
    .filter((index) => index >= 0);
  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled || !native.current) return;
    native.current.value = option.value;
    native.current.dispatchEvent(new Event("change", { bubbles: true }));
    setSelected(option.value);
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div className={styles.select} ref={container} data-enhanced={enhanced}>
      <select
        {...props}
        ref={(node) => {
          native.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        value={value}
        defaultValue={defaultValue}
        className={enhanced ? styles.nativeSelect : className}
        tabIndex={enhanced ? -1 : props.tabIndex}
        aria-hidden={enhanced || undefined}
        onFocus={(event) => {
          if (enhanced) trigger.current?.focus();
          onFocus?.(event);
        }}
        onInvalid={(event) => {
          if (enhanced) {
            event.preventDefault();
            trigger.current?.focus();
          }
          onInvalid?.(event);
        }}
        onChange={(event) => {
          setSelected(event.currentTarget.value);
          onChange?.(event);
        }}
      >
        {children}
      </select>
      {enhanced ? (
        <button
          ref={trigger}
          type="button"
          role="combobox"
          aria-label={accessibleLabel || undefined}
          aria-labelledby={props["aria-labelledby"]}
          aria-describedby={props["aria-describedby"]}
          aria-invalid={props["aria-invalid"]}
          aria-required={props.required}
          aria-expanded={open}
          aria-controls={id}
          aria-haspopup="listbox"
          aria-activedescendant={open ? `${id}-${active}` : undefined}
          disabled={props.disabled}
          className={`${styles.selectTrigger} ${className ?? ""}`}
          onClick={() => {
            setActive(
              Math.max(
                0,
                options.findIndex((option) => option.value === displayValue),
              ),
            );
            setOpen(!open);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              trigger.current?.focus();
              return;
            }
            if (event.key === "Tab") {
              setOpen(false);
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (open) choose(active);
              else {
                setActive(
                  Math.max(
                    0,
                    options.findIndex((option) => option.value === displayValue),
                  ),
                );
                setOpen(true);
              }
              return;
            }
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const position = enabled.indexOf(active);
            const index =
              event.key === "Home"
                ? enabled[0]
                : event.key === "End"
                  ? enabled[enabled.length - 1]
                  : enabled[
                      Math.max(
                        0,
                        Math.min(
                          enabled.length - 1,
                          position + (event.key === "ArrowDown" ? 1 : -1),
                        ),
                      )
                    ];
            if (index !== undefined) setActive(index);
            setOpen(true);
          }}
        >
          <span>
            {options.find((option) => option.value === displayValue)?.label ?? displayValue}
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      ) : null}
      {present ? (
        <div
          className={styles.options}
          role="listbox"
          id={id}
          aria-label={accessibleLabel || undefined}
          aria-hidden={!open}
          inert={!open}
          data-state={open ? "open" : "closed"}
        >
          {options.map((option, index) => (
            <div
              key={`${option.value}-${index}`}
              role="option"
              id={`${id}-${index}`}
              aria-selected={option.value === displayValue}
              aria-disabled={option.disabled}
              data-active={index === active}
              className={styles.option}
              onPointerMove={() => {
                if (!option.disabled) setActive(index);
              }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {option.value === displayValue ? <Check size={16} aria-hidden="true" /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean | undefined;
};
export function Tabs({
  label,
  items,
  value,
  defaultValue,
  onValueChange,
}: {
  label: string;
  items: readonly TabItem[];
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
}) {
  const [selected, setSelected] = useState(
    defaultValue ?? items.find((item) => !item.disabled)?.id ?? "",
  );
  const current = value ?? selected;
  const id = useId();
  function select(next: string) {
    setSelected(next);
    onValueChange?.(next);
  }
  return (
    <div className={styles.tabs}>
      <div role="tablist" aria-label={label} className={styles.tablist}>
        {items.map((item) => (
          <button
            type="button"
            role="tab"
            key={item.id}
            id={`${id}-${item.id}`}
            aria-controls={`${id}-${item.id}-panel`}
            aria-selected={current === item.id}
            tabIndex={current === item.id ? 0 : -1}
            disabled={item.disabled}
            onClick={() => select(item.id)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const enabled = items.filter((entry) => !entry.disabled);
              const index = enabled.findIndex((entry) => entry.id === item.id);
              const next =
                event.key === "Home"
                  ? enabled[0]
                  : event.key === "End"
                    ? enabled[enabled.length - 1]
                    : enabled[
                        (index + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) %
                          enabled.length
                      ];
              if (next) {
                select(next.id);
                document.getElementById(`${id}-${next.id}`)?.focus();
              }
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items
        .filter((item) => item.id === current)
        .map((item) => (
          <div
            role="tabpanel"
            id={`${id}-${item.id}-panel`}
            aria-labelledby={`${id}-${item.id}`}
            key={item.id}
            tabIndex={0}
          >
            {item.content}
          </div>
        ))}
    </div>
  );
}

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  name,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean | undefined;
  name?: string | undefined;
}) {
  return (
    <details className={styles.disclosure} open={defaultOpen || undefined} name={name}>
      <summary>
        {summary}
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div>{children}</div>
    </details>
  );
}
